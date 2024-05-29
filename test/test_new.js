var bigInt = require("big-integer");

const { web3, assert, artifacts } = require("hardhat");
const { generateCredential } = require("../utilities/credential.js");
const { gen, hashToPrime } = require("../utilities/accumulator.js");
const { initBitmap, addToBitmap, getBitmapData, getStaticAccData, checkInclusionBitmap, checkInclusionGlobal } = require("../utilities/bitmap.js");
const { storeEpochPrimes } = require("../utilities/epoch.js");
const { emptyProducts, emptyStaticAccData } = require("../utilities/product");
const { generateRandomString, encrypt, decrypt } = require('../utilities/encryption');

const { revoke, verify } = require("../revocation/revocation");
const {consoleLogToString} = require("hardhat/internal/hardhat-network/stack-traces/consoleLogger");
const crypto = require('crypto');

// using the following approach for testing:
// https://hardhat.org/hardhat-runner/docs/other-guides/truffle-testing

const DID = artifacts.require("DID");
const Cred = artifacts.require("Credentials");
const Admin = artifacts.require("AdminAccounts");
const Issuer = artifacts.require("IssuerRegistry");
const SubAcc = artifacts.require("SubAccumulator");
const Acc = artifacts.require("Accumulator");


describe("DID Registry", function() {
    let accounts;
    let holder;
    let issuer;

    let issuer_;
    let issuer_Pri;

    // bitmap capacity
    let capacity = 30; // up to uin256 max elements

    // contract instances
    let adminRegistryInstance;
    let issuerRegistryInstance;
    let didRegistryInstance;
    let credRegistryInstance;
    let subAccInstance;
    let accInstance;

    before(async function () {
        accounts = await web3.eth.getAccounts();
        holder = accounts[1];
        // issuer = accounts[2];
        // create an account with public/private keys
        issuer_ = web3.eth.accounts.create();
        issuer_Pri = issuer_.privateKey;
        issuer = issuer_.address;
    });

    describe("Deployment", function () {
        it('Deploying the Admin registry contract', async () => {
            adminRegistryInstance = await Admin.new();
            await web3.eth.getBalance(adminRegistryInstance.address).then((balance) => {
                assert.equal(balance, 0, "check balance of the contract");
            });
        });

        it('Deploying the Issuers Registry contract', async () => {
            issuerRegistryInstance = await Issuer.new(adminRegistryInstance.address);
            await web3.eth.getBalance(issuerRegistryInstance.address).then((balance) => {
                assert.equal(balance, 0, "check balance of the contract");
            });
        });

        it('Deploying the DID Registry contract', async () => {
            didRegistryInstance = await DID.new();
            await web3.eth.getBalance(didRegistryInstance.address).then((balance) => {
                assert.equal(balance, 0, "check balance of the contract");
            });
        });

        it('Deploying the Credential Registry contract', async () => {
            credRegistryInstance = await Cred.new();
            await web3.eth.getBalance(credRegistryInstance.address).then((balance) => {
                assert.equal(balance, 0, "check balance of the contract");
            });
        });

        it('Deploying and generating bitmap', async () => {
            subAccInstance = await SubAcc.new(issuerRegistryInstance.address /*, accInstance.address*/);
            await web3.eth.getBalance(subAccInstance.address).then((balance) => {
                assert.equal(balance, 0, "check balance of the contract");
            });

            // calculate how many hash function needed and update in contract
            await initBitmap(subAccInstance, capacity);

            // clean up from previous tests
            emptyProducts();
            emptyStaticAccData();
        });

        it('Deploying and generating global accumulator', async () => {
            let [n, g] = gen();
            // when adding bytes to contract, need to concat with "0x"
            let nHex = "0x" + bigInt(n).toString(16); // convert back to bigInt with bigInt(nHex.slice(2), 16)
            let gHex = "0x" + bigInt(g).toString(16);

            accInstance = await Acc.new(issuerRegistryInstance.address, subAccInstance.address, gHex, nHex);
            await web3.eth.getBalance(accInstance.address).then((balance) => {
                assert.equal(balance, 0, "check balance of the contract");
            });
        });
    });

    describe("Add issuer to the registry", function () {
        it('Adding issuer', async () => {
            await issuerRegistryInstance.addIssuer(issuer);
        });
    });

    describe("Identity Register", function () {
        it('Registering the identity with contract', async () => {
            let now = new Date();
            let ubaasDID = web3.utils.sha3(issuer + now);
            const additionalInfo = generateRandomString(16); // Adjust the length as needed
            await didRegistryInstance.register(holder, ubaasDID, additionalInfo);
            await didRegistryInstance.getInfo(holder).then((result) => {
                console.log(result[0]);
                assert.exists(result[0], "check if did was generated");
            });
        });
    });
});