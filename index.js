const Web3 = require('web3')
const config = require('config')
const HDWalletProvider = require('@truffle/hdwallet-provider');
const Queue = require('bee-queue');
const bluebird = require('bluebird')
const redis = require('redis')

bluebird.promisifyAll(redis);
const client = redis.createClient(config.get('bee-q.redis'))
const web3 = new Web3(new HDWalletProvider(process.env.MNEMONIC, process.env.MAIN_RPC));
const childWeb3 = new Web3(process.env.MATIC_RPC);
let accounts, account

const childToRoot = {}
const network = process.env.NODE_ENV || 'development'
const withdrawsQName = `${network}-withdraws`
const withdrawsQ = new Queue(withdrawsQName, config.get('bee-q'));

async function poll() {
  const lastProcessedKey = `${network}-lastProcessed`
  const toBlock = await childWeb3.eth.getBlockNumber()
  let lastProcessed
  try {
    lastProcessed = await client.getAsync(lastProcessedKey)
    if (lastProcessed == null) lastProcessed = 0
    else lastProcessed = parseInt(lastProcessed)
  } catch(e) {
    lastProcessed = 0
  }
  const fromBlock = Math.max(config.get('fromBlock'), lastProcessed + 1)
  console.log({ fromBlock, toBlock })
  if (fromBlock >= toBlock) {
    await client.setAsync(lastProcessedKey, fromBlock);
    return;
  }

  config.get('contracts.tokens').forEach(async token => {
    const childErc20 = childToRoot[token.child].childErc20;
    try {
      let events = await childErc20.getPastEvents(
        'Transfer',
        { fromBlock, toBlock }
      )
      // console.log('events', events.length)
      events = events.filter(event => {
        return event.raw.topics[2].slice(26).toLowerCase() == account.slice(2).toLowerCase()
      }).forEach(event => {
        withdrawsQ.createJob(event).save();
      })
      await client.setAsync(lastProcessedKey, toBlock);
    } catch(e) {
      console.log(e)
    }
  })
}

async function setup() {
  accounts = await web3.eth.getAccounts()
  account = web3.utils.toChecksumAddress(accounts[0])
  const abi = JSON.parse(JSON.stringify(config.get('contracts.erc20abi')))

  config.get('contracts.tokens').forEach(async token => {
    console.log(token)
    const mainErc20 = new web3.eth.Contract(abi, token.root)
    const childErc20 = new childWeb3.eth.Contract(abi, token.child)
    childToRoot[token.child] = { mainErc20, childErc20 }
  })

  withdrawsQ.process(async function (job, done) {
    console.log(`Processing job ${job.id}`);
    const event = job.data;
    let key = buildKey(event.blockNumber, event.logIndex)
    const _shouldProcess = await shouldProcess(key)
    if (!_shouldProcess) return done(null, key);
    console.log(`key: ${key}`)
    const recipient = '0x' + event.raw.topics[1].slice(26)
    const amount = event.raw.data
    try {
      await client.setAsync(key, true)
      if (web3.utils.toBN(amount).gt(web3.utils.toBN(0))) {
        const nonce = await web3.eth.getTransactionCount(accounts[0], 'pending')
        console.log(`Transferring ${web3.utils.fromWei(amount)} to ${recipient}`)
        await childToRoot[event.address].mainErc20.methods.transfer(recipient, amount).send({
          from: accounts[0],
          gas: 100000,
          nonce,
          gasPrice: web3.utils.toWei(config.get('gasPrice'), 'gwei')
        })
        .on('transactionHash', (hash) => {
          console.log(`Processed ${key}`, hash)
          return done(null, key);
        })
      }
    } catch(e) {
      console.log('error', e)
      await client.setAsync(key, false)
    }
  });
}

function buildKey(blockNumber, index) {
  return `${network}-${blockNumber}-${index}`
}

async function shouldProcess(key) {
  const _isProcessed = await client.getAsync(key)
  if (_isProcessed) console.log(`Key ${key} is already processed`)
  return !_isProcessed
}


setup().then(() => {
  console.log('Bridge server initialized')
  console.log('Withdraw address is', account)
  setInterval(poll, config.get('pollSeconds') * 1000);
})
