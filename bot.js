const express = require('express');
const axios = require('axios');
const Web3 = require('web3');
require('dotenv').config();

const app = express();
app.use(express.json());

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.INFURA_URL));
const privateKey = process.env.PRIVATE_KEY;
const account = web3.eth.accounts.privateKeyToAccount(privateKey);
web3.eth.accounts.wallet.add(account);

const flashLoanContractAddress = process.env.FLASH_LOAN_CONTRACT_ADDRESS;
const flashLoanContractABI = require('./FlashLoanContractABI.json');
const flashLoanContract = new web3.eth.Contract(flashLoanContractABI, flashLoanContractAddress);

app.post('/webhook', async (req, res) => {
    const { priceDifference, buyExchange, sellExchange, buyToken, sellToken, amount } = req.body;

    if (priceDifference > process.env.PROFIT_THRESHOLD) {
        try {
            const tx = flashLoanContract.methods.executeArbitrage(buyExchange, sellExchange, buyToken, sellToken, amount);
            const gas = await tx.estimateGas({ from: account.address });
            const gasPrice = await web3.eth.getGasPrice();
            const data = tx.encodeABI();
            const nonce = await web3.eth.getTransactionCount(account.address);

            const signedTx = await web3.eth.accounts.signTransaction(
                {
                    to: flashLoanContractAddress,
                    data,
                    gas,
                    gasPrice,
                    nonce,
                    chainId: process.env.CHAIN_ID
                },
                privateKey
            );

            const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            console.log('Transaction receipt:', receipt);
        } catch (error) {
            console.error('Error executing arbitrage:', error);
        }
    }

    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Listening for ArbitrageScanner notifications on port ${PORT}`);
});
