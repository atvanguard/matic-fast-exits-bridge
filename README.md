# Matic Bridge

### Backgroud Processes
```
nvm use 11
ganache-cli -b 1
docker run -p 6379:6379 -d redis
```

### Compile
```
npm run truffle compile
npm run truffle migrate -- --reset
```
Copy the output from above migration to [config file](./config/default.json#16) under `contracts` key.

### Env (.env)
```
export MNEMONIC=<> # The one generated in ganache above
export MAIN_RPC='http://127.0.0.1:8545'
export MATIC_RPC='http://127.0.0.1:8545' # For testing it is ok to use the same chain
```

### Run Bridge Server
```
source .env
node <your server>
```

### Test
```
./node_modules/.bin/mocha test/<> --timeout 0 --exit
```
