const sdk = require("@defillama/sdk");
const axios = require('axios')
const {transformFantomAddress} = require("../helper/portedTokens")
const {unwrapUniswapLPs} = require('../helper/unwrapLPs')

const masonryAddress = "0x8764DE60236C5843D9faEB1B638fbCE962773B67"
const tombRewardAddress = "0xa7b9123f4b15fE0fF01F469ff5Eab2b41296dC0E"
//const tshareRewardAddress = "0xcc0a87f7e7c693042a9cc703661f5060c80acb43"
const daoFundAddress = "0x0fa5a3b6f8e26a7c2c67bd205ffcfa9f89b0e8d1"
const devWalletAdd = "0x32439F5A7Dc35590e83AAc0a80762dE27Ab76046"
const tokensDao = ['0x04068da6c83afcfa0e13ba15a6696662335d5b75','0x4733bc45ef91cf7ccecaeedb794727075fb209f2','0x6c021ae822bea943b2e66552bde1d2696a53fbb7','0x4cdf39285d7ca8eb3f090fda0c069ba5f4145b37']
async function tvl(timestamp, block, chainBlocks) {

    const balances = {}
    let lpPositions = []
    let transformAddress = await transformFantomAddress()
    let masonryTokens = (await axios.get(`https://api.covalenthq.com/v1/250/address/${masonryAddress}/balances_v2/?&key=ckey_72cd3b74b4a048c9bc671f7c5a6`)).data.data.items
    let tombTokens = (await axios.get(`https://api.covalenthq.com/v1/250/address/${tombRewardAddress}/balances_v2/?&key=ckey_72cd3b74b4a048c9bc671f7c5a6`)).data.data.items
    //let tshareTokens = (await axios.get(`https://api.covalenthq.com/v1/250/address/${tshareRewardAddress}/balances_v2/?&key=ckey_72cd3b74b4a048c9bc671f7c5a6`)).data.data.items
    let devWallet =  (await axios.get(`https://api.covalenthq.com/v1/250/address/${devWalletAdd}/balances_v2/?&key=ckey_72cd3b74b4a048c9bc671f7c5a6`)).data.data.items

    const tokenBalances = (await sdk.api.abi.multiCall({
        calls: tokensDao.map(token=>({
            target: token,
            params: [daoFundAddress]
        })),
        abi: 'erc20:balanceOf',
        block: chainBlocks['fantom'],
        chain: 'fantom'
    })).output.map((bal) => bal.output);

    tokenBalances.forEach((bal, idx) => {
        if(tokensDao[idx] === '0x4733bc45ef91cf7ccecaeedb794727075fb209f2') {
            lpPositions.push({
                token: tokensDao[idx],
                balance: bal
            })
        } else {
            sdk.util.sumSingleBalance(balances, transformAddress( tokensDao[idx]), bal)
        }
    });

    await Promise.all(
        tombTokens.map( async (token) => {
            if(token.contract_ticker_symbol === 'spLP')
            {
                const uniLocked = sdk.api.erc20.balanceOf({
                    target: token.contract_address,
                    owner: tombRewardAddress,
                    block: chainBlocks['fantom'],
                    chain: 'fantom'
                })

                lpPositions.push({
                    token: token.contract_address,
                    balance: (await uniLocked).output
                })
            }
        }),
        masonryTokens.map( async (token) => {
            if(token.supports_erc) {
                const singleTokenLocked = sdk.api.erc20.balanceOf({
                    target: token.contract_address,
                    owner: masonryAddress,
                    block: chainBlocks['fantom'],
                    chain: 'fantom'

                })
                sdk.util.sumSingleBalance(balances, transformAddress(token.contract_address), (await singleTokenLocked).output)
            }
        }),
        //temporary comment out of tshares due to api error 400
        /*
        tshareTokens.map( async (token) => {
            if(token.contract_ticker_symbol === 'spLP')
            {
                const uniLocked = sdk.api.erc20.balanceOf({
                    target: token.contract_address,
                    owner: tshareRewardAddress,
                    block: chainBlocks['fantom'],
                    chain: 'fantom'
                })

                lpPositions.push({
                    token: token.contract_address,
                    balance: (await uniLocked).output
                })
            }
        }),
        */
        devWallet.map( async (token) => {
            if(token.supports_erc) {
                const singleTokenLocked = sdk.api.erc20.balanceOf({
                    target: token.contract_address,
                    owner: devWalletAdd,
                    block: chainBlocks['fantom'],
                    chain: 'fantom'

                })
                sdk.util.sumSingleBalance(balances, transformAddress(token.contract_address), (await singleTokenLocked).output)
            }
        })
    )

    await unwrapUniswapLPs(balances, lpPositions, chainBlocks['fantom'], 'fantom', transformAddress)
    return balances
}

module.exports = {
    fantom: {
        tvl
    },
    tvl
}

