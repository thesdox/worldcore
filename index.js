import { JSONFilePreset } from 'lowdb/node'
import express from 'express'

// Read or create world.json
const defaultData = {}
const activityDb = await JSONFilePreset('./data/activities.json', [])
const activities = activityDb.data

const accountDb = await JSONFilePreset('./data/accounts.json', [])
const accounts = accountDb.data

const assetDb = await JSONFilePreset('./data/assets.json', [])
const assets = assetDb.data

const currentDb = await JSONFilePreset('./data/current.json', [])
const current = currentDb.data

const worldDb = await JSONFilePreset('./data/world.json', defaultData)
const world = worldDb.data

console.log(`starting worldcore service..`)

const app = express()
const port = 3000

//app.use(express.json)
app.use(express.urlencoded({ extended: true }))

app.get('/', (req, res) => {
    const username = req.query.user ? req.query.user : "world"
    const account = accounts.find(a => a.id == username)

    const items = assets.filter(a => a.owner == account.id)
    let inventoryHtml = "<p>Empty<p>"
    if (items.length > 0) {
        inventoryHtml = "<ul>"
        items.forEach(i => {
            inventoryHtml += `<li>${i.type} ${i.amount}</li>`
        })
        inventoryHtml += "</ul>"
    }

    res.send(`
        <h1><a href="/">Worldcore</a></h1>
        <h4><a href="/current">T${current.time}</a> - Water: ${current.resources.water.balance.toFixed(0)} - Mineral: ${current.resources.mineral.balance.toFixed(0)} - Credits: ${current.resources.credits.balance.toFixed(2)}</h4>
        <ul>
            <li><a href="/accounts">accounts (${accounts.length})</a></li>
            <li><a href="/activities">activities (${activities.length})</a></li>
            <li><a href="/assets">assets (${assets.length})</a></li>
        </ul>

        <h3>${username}'s balance: ${account.credits.balance.toFixed(2)} credit</h3>
        <form action="/collect" method="post">
            <input type="hidden" name="owner" value="${username}" />
            <button name="resource" value="water">Collect Water (5-10)</button>
            <button name="resource" value="mineral">Collect Mineral (1-3)</button>
        </form>
        <h3>Inventory (<a href="/assets?user=${username}">${account.inventory.items.length}</a>)</h3>
        ${inventoryHtml}

        <h2>Mint account</h2>
        <form action="/mint" method="post">
            <input name="username" placeholder="username" required />
            <button name="type" value="account">Mint</button>
        </form>

        <h2>Mint items</h2>
        <form action="/mint" method="post">
            <h3>Bankstone</h3>
            <input name="owner" placeholder="owner" required />
            <button name="type" value="bankstone">Mint</button>
        </form>
        `)
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
            amount = getRandomNumber(5, 10)
            break
        case "mineral":
            amount = getRandomNumber(1, 3)
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

app.get('/accounts', (req, res) => {
    res.send(accounts)
})

app.get('/activities', (req, res) => {
    res.send(activities)
})

app.get('/assets', (req, res) => {
    let filteredAssets = assets
    if (req.query.user) {
        filteredAssets = assets.filter(a => a.owner == req.query.user)
    }

    res.send(filteredAssets)
})

app.get('/current', (req, res) => {
    res.send(current)
})

app.listen(port, () => {
    console.log(`app listening on port ${port}`)
})

setInterval(async () => {
    console.log(`current: T${current.time}`)
    console.log(`active accounts: ${current.accounts.length}/${accounts.length} transactions: ${activities.length}/${activities.length}`)
    const startTime = new Date().getTime()

    const waterRate = getRandomNumber(world.resources.water.rateLo, world.resources.water.rateHi)/100/world.interval.year/world.interval.day
    const mineralRate = getRandomNumber(world.resources.mineral.rateLo, world.resources.mineral.rateHi)/100/world.interval.year/world.interval.day

    const remainingWater = (world.resources.water.total - current.resources.water.supplied)
    const water = remainingWater * waterRate

    const remainingMineral = (world.resources.water.total - current.resources.water.supplied)
    const mineral = remainingMineral * mineralRate

    current.resources.water.balance += water
    current.resources.water.supplied += water

    current.resources.mineral.balance += mineral
    current.resources.mineral.supplied += mineral

    queueDividend()

    await processCurrentActivitiesAsync()

    if (current.activities.completed.length >= world.system.batch) {
        await activityDb.write()
        await assetDb.write()
        await accountDb.write()
        await worldDb.write()

        current.activities.completed.length = 0
    }

    await currentDb.write()

    const elapsed = new Date().getTime() - startTime
    console.log(`Sync completed in ${elapsed}ms`)

    current.time += 1;
}, world.interval.hour)

function queueDividend() {
    console.log(`processing ${current.bankstones.length} bankstones..`);
    current.bankstones.forEach(id => {
        const b = assets.find(a => a.id == id)
        if (!b) {
            console.error(`invalid bankstone id ${id}`);
        }

        const hrYield = b.properties.yield / world.interval.year / world.interval.day

        const tx = {
            type: "transaction",
            id: `TX${current.txIdx++}`,
            of: "credit",
            from: b.id,
            to: b.owner,
            amount: hrYield * b.properties.staked,
            note: `dividend yield for day ${Math.floor(current.time % (world.interval.year / world.interval.day))}`,
            times: {
                created: current.time
            }
        }

        console.log(`${tx.id}: ${hrYield.toFixed(6) * 100}/${b.properties.yield * 100}% of staked ${b.properties.staked}/${b.properties.cap} credit.. yields ${tx.amount.toFixed(2)} hourly credit..`);
        activities.push(tx)
        current.activities.pending.push(tx.id);
    });
}

async function processCurrentActivitiesAsync() {
    current.activities.pending.forEach((id) => {
        const activity = activities.find(a => a.id == id)
        if (!activity) {
            console.error(`pending activity ${id} not found`)
        } else {
            console.log(`processing activity ${activity.id}..`)
            switch (activity.type) {
                case "system":
                    processPendingSystemActivity(activity)
                    break
                case "transaction":
                    processPendingTransaction(activity)
                    break
                case "mint":
                    processPendingMint(activity)
                    break
                case "collect":
                    processPendingCollect(activity)
                    break
                default:
                    break
            }

            activity.times.completed = current.time
            current.activities.completed.push(activity.id)
            current.activities.pending = current.activities.pending.filter(id => id !== activity.id)
        }
    })
}

function processPendingCollect(collect) {
    console.log(`#${collect.id}: collecting ${collect.of} from ${collect.from} to ${collect.to}...`)
    
    const resource = assets.find(a => a.type == collect.of && a.owner == collect.to)

    if (resource) {
        resource.amount += collect.amount
    } else {
        let id = collect.id
        switch (collect.of) {
            case "water":
                id = `WTR${current.collectIdx}`
                break
            case "mineral":
                id = `MNR${current.collectIdx}`
                break
            default:
                break
        }
    
        assets.push({
            "id": id,
            "type": collect.of,
            "amount": collect.amount,
            "owner": collect.to
        })
    
        const owner = accounts.find(a => a.id == collect.to)
        owner.inventory.items.push(id);
    }

    current.collectIdx += 1
}

function processPendingSystemActivity(activity) {
    switch (activity.of) {
        case "connection":
            console.log(`processing connection from ${activity.from} to ${activity.to}...`)
            const existingConnection = current.accounts.find(id => id == activity.from)
            if (!existingConnection) {
                current.accounts.push(activity.from)
            }

            const account = accounts.find(a => a.id == activity.from);
            account.times.lastActive = current.time
            break
        default:
            break
    }
}

function processPendingMint(mint) {
    console.log(`#${mint.id}: minting an ${mint.of} from ${mint.from} to ${mint.to}...`)
    
    switch (mint.of) {
        case "account":
            accounts.push({
                "id": mint.to,
                "credits": {
                  "balance": 0
                },
                "inventory": {
                  "items": []
                },
                "times": {
                  "created": current.time,
                  "updated": current.time,
                  "lastActive": current.time
                }
            })
            break
        case "bankstone":
            const yld = getRandomNumber(world.items.bankstone.rateLo, world.items.bankstone.rateHi)/100
            const cap = getRandomNumber(world.items.bankstone.capLo, world.items.bankstone.capHi)

            const id = `BNK${current.assetIdx}`
            assets.push({
                "id": id,
                "type": "bankstone",
                "amount": 1,
                "properties": {
                    "yield": yld,
                    "cap": cap,
                    "staked": 0
                },
                "owner": mint.to
            })

            const owner = accounts.find(a => a.id == mint.to)
            owner.inventory.items.push(id);
            break
        default:
            break
    }

    current.assetIdx += 1
}

function getRandomNumber(min, max) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const randomValue = array[0] / (0xffffffff + 1);
    return Math.floor(randomValue * (max - min + 1)) + min;
}

function processPendingTransaction(transaction) {
    console.log(`#${transaction.id}: sending ${transaction.amount} ${transaction.of} from ${transaction.from} to ${transaction.to}...`)

    const from = accounts.find(a => a.id == transaction.from)
    const to = accounts.find(a => a.id == transaction.to)

    if (!transaction.from.startsWith("BNK")) {
        from.credits.balance -= transaction.amount
    }
    
    to.credits.balance += transaction.amount
}

