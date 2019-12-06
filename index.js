const Web3 = require('web3')
const config = require('config')
const HDWalletProvider = require('@truffle/hdwallet-provider');
const Queue = require('bee-queue');
const bluebird = require('bluebird')
const redis = require('redis')

bluebird.promisifyAll(redis);
const client = redis.createClient(config.get('bee-q.redis'))
const web3 = new Web3(new HDWalletProvider(process.env.MNEMONIC, process.env.MAIN_RPC));
const childWeb3 = new Web3(new Web3.providers.WebsocketProvider(process.env.MATIC_RPC));
let accounts

const childToRoot = {}
const withdrawsQName = 'withdraws'

async function setup() {
  accounts = await web3.eth.getAccounts()
  let account = web3.utils.toChecksumAddress(accounts[0])
  const withdrawsQ = new Queue(withdrawsQName, config.get('bee-q'));
  const abi = JSON.parse(JSON.stringify(config.get('contracts.erc20abi')))

  config.get('contracts.tokens').forEach(token => {
    const mainErc20 = new web3.eth.Contract(abi, token.root)
    const childErc20 = new childWeb3.eth.Contract(abi, token.child)
    childToRoot[token.child] = mainErc20

    // subscribe to events where we receive tokens
    childErc20.events.Transfer({ filter: { to: account }, fromBlock: config.get('fromBlock') }, (err) => {
      if (err) console.log(err)
    })
    .on('connected', function(subscriptionId) {
      console.log(`Listening to Transfer(,${account},) events on child contract ${childErc20.options.address}`);
    })
    .on('data', async event => {
      withdrawsQ.createJob(event).save();
    })
  })


  withdrawsQ.process(async function (job, done) {
    console.log(`Processing job ${job.id}`);
    const event = job.data;
    if (!shouldProcess(event)) return;
    console.log(event)
    const recipient = '0x' + event.raw.topics[1].slice(26)
    const amount = event.raw.data
    let key
    try {
      key = buildKey(event.blockNumber, event.logIndex)
      await client.setAsync(key, true)
      if (web3.utils.toBN(amount).gt(web3.utils.toBN(0))) {
        console.log(`Transferring ${web3.utils.fromWei(amount)} to ${recipient}`)
        await childToRoot[event.address].methods.transfer(recipient, amount).send({
          from: accounts[0], gas: 100000, nonce: await web3.eth.getTransactionCount(accounts[0], 'pending') })
      }
      console.log(`Processed ${key}`)
      return done(null, key);
    } catch(e) {
      console.log('error', e)
      await client.setAsync(key, false)
    }
  });
}

function buildKey(hash, index) {
  return `${hash}-${index}`
}

async function shouldProcess(event) {
  const key = buildKey(event.transactionHash, event.logIndex)
  const _isProcessed = await client.getAsync(key)
  if (_isProcessed) console.log(`Key ${key} is already processed`)
  return !_isProcessed
}

setup().then(() => console.log('Bridge server initialized'))
