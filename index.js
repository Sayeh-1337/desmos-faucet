import 'dotenv/config';
import bodyParser from 'body-parser';
import cosmosjs from '@cosmostation/cosmosjs'
import { reset } from 'nodemon';

const chainId = process.env.CHAIN_ID;
const lcdAddress = process.env.LCD_ADDRESS;
const walletPath = process.env.HD_WALLET_PATH;
const mnemonic = process.env.MNEMONIC;
const bech32Prefix = process.env.BECH32_PREFIX;
const amount = process.env.AMOUNT;
const denom = process.env.DENOM;
const minutes = parseInt(process.env.MINUTES);
const memo = process.env.MEMO;
const cosmos = cosmosjs.network(lcdAddress, chainId);

cosmos.setPath(walletPath);
cosmos.setBech32MainPrefix(bech32Prefix);

const address = cosmos.getAddress(mnemonic);
const ecpairPriv = cosmos.getECPairPriv(mnemonic);

const express = require('express')
const app = express()
const port = 3456

const airdropInterval = minutes*60*1000;

const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const adapter = new FileSync('db.json')
const db = low(adapter)
const historyStore = db.get('history');
// db.defaults({ history: [] })
//   .write()
  


app.set('view engine', 'pug')

const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) {
    // res.render('index', { title: 'Hey', message: 'Hello there!' })
    res.render('index', {
        chainId: chainId,
        denom: denom
    });
});

app.post('/airdrop', (req, res) => {
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    let existingIP = historyStore
        .find({ ip: ip })
        .value()

        console.log(Date.now()-existingIP.airdropTime);
        console.log(airdropInterval);

    if ((typeof existingIP == "undefined") || (Date.now()-existingIP.airdropTime >= airdropInterval)){
        
        cosmos.getAccounts(address).then(data => {
            let stdSignMsg = cosmos.NewStdMsg({
                type: "cosmos-sdk/MsgSend",
                from_address: address,
                to_address: req.body.address,
                amountDenom: denom,
                amount: amount,
                feeDenom: denom,
                fee: 0,
                gas: 200000,
                memo: memo,
                account_number: data.result.value.account_number,
                sequence: data.result.value.sequence
            });

            const signedTx = cosmos.sign(stdSignMsg, ecpairPriv);
            cosmos.broadcast(signedTx).then(response => {
                let now = Date.now();
                if (typeof existingIP !== "undefined"){
                    historyStore.find({ ip: ip })
                        .assign({airdropTime: now})
                        .write();
                }
                else{
                    historyStore
                        .push({ ip: ip, airdropTime: now})
                        .write()
                }
                res.send(response)
            });
        })
    }
    else{
        res.send({message: 'You are not ready. Pleae come back again tomorrow.'});
    }
})

app.listen(port, () => console.log(`Airdropping... ${port}!`))