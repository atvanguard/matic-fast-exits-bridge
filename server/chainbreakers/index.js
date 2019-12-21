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
let accounts

const childToRoot = {}
const network = process.env.NODE_ENV || 'development'
const withdrawsQName = `${network}-withdraws`
const withdrawsQ = new Queue(withdrawsQName, config.get('bee-q'));
const tokenUriMap = {}

async function poll() {
  const lastProcessedKey = `${network}-lastProcessed`
  const toBlock = await childWeb3.eth.getBlockNumber()
  let lastProcessed
  try {
    lastProcessed = await client.getAsync(lastProcessedKey)
    if (lastProcessed == null) lastProcessed = -1
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

  const token = config.get('contracts.tokens.chainbreakers')
  const childErc721 = childToRoot[token.child].child;
  try {
    let events = await childErc721.getPastEvents(
      'Transfer',
      { filter: { from: '0x0000000000000000000000000000000000000000' } },
      { fromBlock, toBlock }
    )
    // console.log(events)
    await bluebird.map(events, async event => {
      try {
        const tokenId = event.raw.topics[3].toLowerCase()
        tokenUriMap[tokenId] = await childErc721.methods.tokenURI(tokenId).call()
      } catch(e) {
        // token was already burnt or doesnt exist for some reason
      }
    }, { concurrency: 3 } )
    // console.log({ tokenUriMap })

    events = await childErc721.getPastEvents(
      'Withdraw',
      { fromBlock, toBlock }
    )
    // console.log('events', events.length)
    events.forEach(event => {
      withdrawsQ.createJob(event).save();
    })
    await client.setAsync(lastProcessedKey, toBlock);
  } catch(e) {
    console.log(e)
  }
}

async function setup() {
  accounts = await web3.eth.getAccounts()

  const token = config.get('contracts.tokens.chainbreakers')
  console.log(token)
  const root = new web3.eth.Contract(
    require('../../build/contracts/ChainbreakersPetsERC721.json').abi,
    token.root
  )
  const child = new childWeb3.eth.Contract(
    require('../../build/contracts/ChildERC721Mintable.json').abi,
    token.child
  )
  childToRoot[token.child] = { root, child }

  withdrawsQ.process(async function (job, done) {
    console.log(`Processing job ${job.id}`);
    const event = job.data;
    // console.log(event)
    let key = buildKey(event.blockNumber, event.logIndex)
    const _shouldProcess = await shouldProcess(key)
    if (!_shouldProcess) return done(null, key);
    console.log(`key: ${key}`)
    const recipient = '0x' + event.raw.topics[2].slice(26)
    const tokenId = event.raw.data.toLowerCase()
    try {
      await client.setAsync(key, true)
      const nonce = await web3.eth.getTransactionCount(accounts[0], 'pending')
      console.log(`Minting ${tokenId} to ${recipient}`)

      await childToRoot[event.address].root.methods.mintWithTokenURI(recipient, tokenId, tokenUriMap[tokenId] || '').send({
        from: accounts[0],
        gas: 1000000,
        nonce,
        // gasPrice: web3.utils.toWei(config.get('gasPrice'), 'gwei')
      })
      .on('transactionHash', (hash) => {
        console.log(`Processed ${key}`, hash)
        return done(null, key);
      })
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
  setInterval(poll, config.get('pollSeconds') * 1000);
})
