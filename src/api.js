import * as util from './utility.js'
import express from 'express'
import session from 'express-session'
import { accounts, activities, assets, market, current, world, auth } from './model.js'
import * as bcrypt from 'bcrypt'

export const app = express()

app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}))

app.use(express.urlencoded({ extended: true }))

app.post('/auth', function(req, res) {
	let username = req.body.username;
	let password = req.body.password;

	if (username && password) {
        const user = auth.find(a => a.username == username)
        if (!user) res.sendStatus(401)

        bcrypt.compare(password, user.password, (err, result) => {
            if (result && auth.findIndex(a => a.username == username && a.password == password > 0)) {
                req.session.username = username;
                res.redirect('/');
            } else {
                console.warn(err)
                res.sendStatus(401)
            }
        })
	} else {
        res.sendStatus(400)
    }
});

app.get('/auths', function(req, res) {
    res.json(auth)
})

app.get('/exit', function(req, res) {
    req.session.destroy((err) => {
        if (err) console.warn(err)
        res.redirect('/')
    })
})

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

    setTimeout(() => req.query.return ?
        res.redirect(req.query.return) : res.json(activity),
        world.interval.minute)
})

app.post('/mint', (req, res) => {
    const id = `MNT${activities.length}`
    console.log(`${id}: minting ${req.body.type}...`);

    const to = req.body.type == "account" ? req.body.username : req.body.owner
    const account = accounts.find(a => a.id == to)
    const userWaters = assets.filter(a => a.owner == to && a.type == "water")
    const userMinerals = assets.filter(a => a.owner == to && a.type == "mineral")

    const activity = {
        "type": "mint",
        "id": id,
        "of": req.body.type,
        "from": "world",
        "to": to,
        "amount": 1,
        "note": `Minting of ${req.body.type} for ${to}`,
        "times": {
            "created": current.time
        }
    }

    activities.push(activity)

    const consumptions = []
    switch (req.body.type) {
        case "account":
            bcrypt.hash(req.body.password, 2, (err, hash) => {
                if (err) {
                    throw err
                }
                
                auth.push({
                    username: to,
                    password: hash
                })
    
                console.log(`${id}: granting access to ${to}...`);
                req.session.username = to
            })
            break
        case "bankstone":
            if (account.credits.balance < 100 ||
                userWaters.reduce((sum, c) => sum + c.amount, 0) < 6  ||
                userMinerals.reduce((sum, c) => sum + c.amount, 0) < 1) {
                console.error(`not enough balance to consume`)
            }

            const creditConsumption = {
                "type": "consume",
                "id": `CNS${activities.length}`,
                "of": "credits",
                "from": to,
                "to": "world",
                "amount": 100,
                "note": `Consuming minting ${id} cost of ${100.00} credit`,
                "times": {
                    "created": current.time
                }
            }
        
            activities.push(creditConsumption)
            const waterCost = Math.ceil(current.resources.water.supplied*Math.log(accounts.length*accounts.length)/current.resources.mineral.supplied)
            const waterConsumption = {
                "type": "consume",
                "id": `CNS${activities.length}`,
                "of": 'water',
                "from": to,
                "to": "world",
                "amount": waterCost,
                "note": `Consuming minting ${id} cost of ${waterCost} water`,
                "times": {
                    "created": current.time
                }
            }
            
            activities.push(waterConsumption)
        
            const mineralConsumption = {
                "type": "consume",
                "id": `CNS${activities.length}`,
                "of": "mineral",
                "from": to,
                "to": "world",
                "amount": 10,
                "note": `Consuming minting ${id} cost of ${1} resource`,
                "times": {
                    "created": current.time
                }
            }
        
            activities.push(mineralConsumption)

            consumptions.push(... [creditConsumption, mineralConsumption, waterConsumption])
            current.activities.pending.push(... [creditConsumption.id, mineralConsumption.id, waterConsumption.id])
            break
        default:
            break
    }

    current.activities.pending.push(activity.id)

    setTimeout(() => req.query.return ?
        res.redirect(req.query.return) : res.json([activity,... consumptions]),
        world.interval.minute)
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

    setTimeout(() => req.query.return ?
        res.redirect(req.query.return) : res.json(activity),
        world.interval.minute)
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

        setTimeout(() => req.query.return ?
            res.redirect(req.query.return) : res.json([creditTx, itemTx]),
            world.interval.minute)
    }
})