import * as util from './utility.js'
import express from 'express'
import { accounts, activities, assets, market, current } from './model.js'

export const app = express()
app.use(express.urlencoded({ extended: true }))

app.post('/transaction', (req, res) => {
    console.log(`sending ${req.body.of}...`);

    const tx = {
        type: "transaction",
        id: `TX${current.txIdx++}`,
        of: "credit",
        from: req.body.from,
        to: req.body.to,
        amount: Number(req.body.amount),
        note: ``,
        times: {
            created: current.time
        }
    }

    activities.push(tx)
    current.activities.pending.push(tx.id)

    res.json(tx)
})

app.post('/mint', (req, res) => {
    console.log(`minting ${req.body.type}...`);

    let type = undefined
    let to = undefined
    switch (req.body.type) {
        case "account":
            type = "account"
            to = req.body.username
            break
        case "bankstone":
            type = "bankstone"
            to = req.body.owner
            // water = req.body.water
            // mineral = req.body.mineral
            
            // const waterConsumption = {
            // }

            // activities.push(waterConsumption)
            // current.activities.pending.push(waterConsumption.id)

            // const mineralConsumption = {
            // }

            // activities.push(mineralConsumption)
            // current.activities.pending.push(mineralConsumption.id)
            break
        default:
            break
    }

    const activity = {
        "type": "mint",
        "id": `MNT${current.assetIdx}`,
        "of": type,
        "from": "world",
        "to": to,
        "amount": 1,
        "note": `Minting of ${type} for ${to}`,
        "times": {
            "created": current.time
        }
    }

    activities.push(activity)
    current.activities.pending.push(activity.id)

    res.json(activity)
})

app.post('/collect', (req, res) => {
    console.log(`collecting ${req.body.resource}...`);

    let amount = 0
    switch (req.body.resource) {
        case "water":
            amount = util.getRandomNumber(5, 10)
            break
        case "mineral":
            amount = util.getRandomNumber(1, 3)
            break
        default:
            break
    }

    const activity = {
        "type": "collect",
        "id": `CLT${current.collectIdx}`,
        "of": req.body.resource,
        "from": "world",
        "to": req.body.owner,
        "amount": amount,
        "note": `Collecting of ${req.body.resource} for ${req.body.owner}`,
        "times": {
            "created": current.time
        }
    }

    activities.push(activity)
    current.activities.pending.push(activity.id)

    res.json(activity)
})

app.post('/sell', (req, res) => {
    const listing = {
        id: `LST${current.listingIdx++}`,
        item: req.body.id,
        price: req.body.price,
        owner: req.body.owner,
        amount: req.body.amount ? req.body.amount : 1,
        times: {
            created: current.time,
            lastUpdated: current.time
        }
    }

    const item = assets.find(a => a.id == listing.item)
    item.amount -= listing.amount
    market.push(listing)

    res.json(listing)
})

app.post('/buy', (req, res) => {
    const item = assets.find(a => a.id == req.body.id)
    const listing = market.find(l => l.item == item.id)
    console.log(`buying ${item.id} at ${listing.price}...`);

    const creditTx = {
        type: "transaction",
        id: `TX${current.txIdx++}`,
        of: "credit",
        from: req.body.buyer,
        to: item.owner,
        amount: listing.amount,
        note: `Purchase of ${item.id} at ${listing.price} credit`,
        times: {
            created: current.time
        }
    }

    const itemTx = {
        type: "transaction",
        id: `TX${current.txIdx++}`,
        of: item.id,
        from: item.owner,
        to: req.body.buyer,
        amount: listing.amount,
        note: `Sale of ${item.id} at ${listing.price} credit`,
        times: {
            created: current.time
        }
    }

    activities.push(creditTx)
    current.activities.pending.push(creditTx.id)

    activities.push(itemTx)
    current.activities.pending.push(itemTx.id)

    res.json([creditTx, itemTx])
})

app.get('/accounts', (req, res) => {
    res.json(accounts)
})

app.get('/activities', (req, res) => {
    res.json(activities)
})

app.get('/assets', (req, res) => {
    let filteredAssets = assets
    if (req.query.user) {
        filteredAssets = assets.filter(a => a.owner == req.query.user)
    }

    res.json(filteredAssets)
})

app.get('/current', (req, res) => {
    res.json(current)
})

app.get('/market', (req, res) => {
    res.json(market)
})