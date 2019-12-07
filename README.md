# Matic Bridge

### Backgroud Processes
```
nvm use 11
ganache-cli
docker run -p 6379:6379 -d redis
```

### Compile
```
npm run truffle:compile
npm run truffle migrate -- --reset
```
Copy the output from above migration to [config file](./config/default.json#16) under `contracts` key.

### Env (testnet.env)
```
export MNEMONIC=<>
export MAIN_RPC='http://127.0.0.1:8545'
export MATIC_RPC='ws://127.0.0.1:8545' // should be websocket
```

### Run Bridge Server
```
source production.env
pm2 start ecosystem.config.js --env production
```

### Test
```
npm run mocha
```
