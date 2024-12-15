import * as util from './utility.js'
import express from 'express'
import { accounts, activities, assets, market, current, world } from './model.js'

export const app = express()
app.use(express.urlencoded({ extended: true }))

app.get('/accounts', (req, res) => {
    res.json(accounts)
})

app.get('/activities', (req, res) => {
    let filteredActivities = activities
    if (req.query.type) {
        filteredActivities = activities.filter(a => a.type == req.query.type)
    }

    if (req.query.user) {
        filteredActivities = activities.filter(a => a.from == req.query.user || a.to == req.query.user)
    }

    res.json(filteredActivities)
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
    let filteredListing = market
    if (req.query.user) {
        filteredListing = market.filter(a => a.owner == req.query.user)
    }

    res.json(filteredListing)
})

app.post('/transaction', (req, res) => {
    const id = `TX${activities.length}}`
    console.log(`${id}: sending ${req.body.of}...`);

    const activity = {
        type: "transaction",
        id: id,
        of: "credit",
        from: req.body.from,
        to: req.body.to,
        amount: Number(req.body.amount),
        note: ``,
        times: {
            created: current.time
        }
    }

    activities.push(activity)
    current.activities.pending.push(activity.id)

    setTimeout(req.query.return ? res.redirect(req.query.return) : res.json(activity), world.interval.minute)
})

app.post('/mint', (req, res) => {
    const id = `MNT${activities.length}`
    console.log(`${id}: minting ${req.body.type}...`);

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
        "id": id,
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

    setTimeout(req.query.return ? res.redirect(req.query.return) : res.json(activity), world.interval.minute)
})

app.post('/collect', (req, res) => {
    const id = `CLT${activities.length}`
    console.log(`${id}: collecting ${req.body.resource}...`);

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
        "id": id,
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

    setTimeout(req.query.return ? res.redirect(req.query.return) : res.json(activity), world.interval.minute)
})

app.post('/list', (req, res) => {
    const id = `LST${market.length}`
    console.log(`${id}: listing ${req.body.id} for sale...`)

    const listing = {
        id: id,
        item: req.body.id,
        price: Number(req.body.price),
        owner: req.body.owner,
        amount: Number(req.body.amount),
        times: {
            created: current.time,
            lastUpdated: current.time
        }
    }

    const item = assets.find(a => a.id == listing.item)
    item.amount -= listing.amount
    market.push(listing)

    req.query.return ? res.redirect(req.query.return) : res.json(listing)
})

app.post('/trade', (req, res) => {
    const listing = market.find(l => l.id == req.body.id)
    const item = assets.find(a => a.id == listing.item)

    if (req.body.buyer == item.owner) {
        // delist and restore amount
        item.amount += listing.amount
        listing.times.expired = current.time

        req.query.return ? res.redirect(req.query.return) : res.json([item, listing])
    } else {
        console.log(`TX${activities.length}: buying ${item.id} at ${listing.price}...`);

        const creditTx = {
            type: "transaction",
            id: `TX${activities.length}`,
            of: "credit",
            from: req.body.buyer,
            to: item.owner,
            amount: listing.price,
            note: `Purchase of ${item.id} at ${listing.price} credit`,
            times: {
                created: current.time
            }
        }

        activities.push(creditTx)
    
        const itemTx = {
            type: "transaction",
            id: `TX${activities.length}`,
            of: item.id,
            from: item.owner,
            to: req.body.buyer,
            amount: listing.amount,
            note: `Sale of ${item.id} at ${listing.price} credit`,
            times: {
                created: current.time
            }
        }

        activities.push(itemTx)

        current.activities.pending.push(creditTx.id)
        current.activities.pending.push(itemTx.id)
        listing.times.sold = current.time

        setTimeout(req.query.return ? res.redirect(req.query.return) : res.json([creditTx, itemTx]), world.interval.minute)
    }
})