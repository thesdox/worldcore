import * as util from './utility.js'
import * as model from './model.js'
import { accounts, activities, assets, world, market, current } from './model.js'

export async function onMinuteAsync() {
    // console.debug(`T${current.time}, active accounts: ${current.accounts.length}/${accounts.length} transactions: ${activities.length}/${activities.length}`)
    const startTime = new Date().getTime()

    if (current.time % world.interval.hour == 0) {
        onHourAsync()
    }

    processResources()
    await processCurrentActivitiesAsync()

    if (current.activities.completed.length >= world.system.batch) {
        console.log(`processing batch store of ${current.activities.completed.length}/${world.system.batch} activities..`)
        await model.activityDb.write()
        await model.assetDb.write()
        await model.accountDb.write()
        await model.worldDb.write()
        await model.marketDb.write()

        current.activities.completed.length = 0
    }

    await model.currentDb.write()

    const elapsed = new Date().getTime() - startTime
    console.log(`T${current.time}: sync completed in ${elapsed}ms`)

    current.time += 1;
}

function processResources() {
    const waterRate = util.getRandomNumber(world.resources.water.rateLo, world.resources.water.rateHi)/100/world.interval.year/world.interval.day/world.interval.minute
    const mineralRate = util.getRandomNumber(world.resources.mineral.rateLo, world.resources.mineral.rateHi)/100/world.interval.year/world.interval.day/world.interval.minute

    const remainingWater = (world.resources.water.total - current.resources.water.supplied)
    const water = remainingWater * waterRate

    const remainingMineral = (world.resources.water.total - current.resources.water.supplied)
    const mineral = remainingMineral * mineralRate

    current.resources.water.balance += water
    current.resources.water.supplied += water

    current.resources.mineral.balance += mineral
    current.resources.mineral.supplied += mineral
}

async function onHourAsync() {
    const effectItems = assets.filter(a => a.type == "bankstone" && a.amount > 0)
    effectItems.forEach(i => {
        if (current.effects.findIndex(e => e == i.id) < 0) current.effects.push(i.id)
    })

    console.debug(`T${current.time}: processing ${current.effects.length} active effects...`)

    const invalid = []
    current.effects.forEach(id => {
        const b = assets.find(a => a.id == id && a.amount > 0)
        if (!b) {
            console.warn(`invalid bankstone id ${id}`);
            invalid.push(id)
            return;
        }

        const hrYield = b.properties.yield/world.interval.year/world.interval.day

        const tx = {
            type: "transaction",
            id: `TX${activities.length}`,
            of: "credit",
            from: b.id,
            to: b.owner,
            amount: hrYield * b.properties.staked,
            note: `dividend yield for day ${Math.floor(current.time % (world.interval.year / world.interval.day))}`,
            times: {
                created: current.time
            }
        }

        console.log(`${tx.id}: ${(hrYield * 100).toFixed(4)}/${(b.properties.yield * 100).toFixed(0)}% of staked ${b.properties.staked.toFixed(0)}/${b.properties.cap} credit.. yields ${tx.amount.toFixed(2)} hourly credit..`);
        activities.push(tx)
        current.activities.pending.push(tx.id);
    });

    // console.debug(`removing ${inactives.length} inactive bankstones...`)
    invalid.forEach((i) => {
        const idx = current.effects.findIndex(b => b == i)
        current.effects.splice(current.effects[idx], 1)
    })
}

async function processCurrentActivitiesAsync() {
    current.activities.pending.forEach((id) => {
        const activity = activities.find(a => a.id == id)
        if (!activity) {
            console.error(`pending activity ${id} not found`)
        } else {
            // console.debug(`processing activity ${activity.id}..`)
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
    console.log(`${collect.id}: collecting ${collect.of} from ${collect.from} to ${collect.to}...`)

    current.resources[collect.of].balance -= collect.amount
    current.resources[collect.of].supplied += collect.amount
    
    const resource = assets.find(a => a.type == collect.of && a.owner == collect.to)
    if (resource) {
        resource.amount += collect.amount
    } else {
        let id = collect.id
        switch (collect.of) {
            case "water":
                id = `WTR${assets.length}`
                break
            case "mineral":
                id = `MNR${assets.length}`
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
    console.log(`${mint.id}: minting an ${mint.of} from ${mint.from} to ${mint.to}...`)
    
    switch (mint.of) {
        case "account":
            accounts.push({
                "id": mint.to.toLowerCase(),
                "credits": {
                  "balance": 0
                },
                "times": {
                  "created": current.time,
                  "updated": current.time,
                  "lastActive": current.time
                }
            })
            break
        case "bankstone":
            const yld = util.getRandomNumber(world.items.bankstone.rateLo, world.items.bankstone.rateHi)/100
            const cap = util.getRandomNumber(world.items.bankstone.capLo, world.items.bankstone.capHi)

            const id = `BNK${assets.length}`
            assets.push({
                "id": id,
                "type": "bankstone",
                "amount": 1,
                "properties": {
                    "yield": yld,
                    "cap": cap,
                    "staked": cap
                },
                "owner": mint.to
            })
            break
        default:
            break
    }
}

function processPendingTransaction(transaction) {
    console.log(`${transaction.id}: sending ${transaction.amount.toFixed(2)} ${transaction.of} from ${transaction.from} to ${transaction.to}...`)

    const from = accounts.find(a => a.id == transaction.from)
    const to = accounts.find(a => a.id == transaction.to)

    switch(transaction.of) {
        case "credit":
            if (transaction.from.startsWith("BNK")) {
                const bank = assets.find(a => a.id == transaction.from)
                bank.properties.staked -= transaction.amount
                current.resources.credits.balance +=transaction.amount
                current.resources.credits.supplied +=transaction.amount
            } else {
                from.credits.balance -= transaction.amount
            }

            to.credits.balance += transaction.amount
            break
        default:
            const item = assets.find(a => a.id == transaction.of)
            item.owner = to.id
            item.amount += transaction.amount

            if (item.amount - transaction.amount < 0) {
                console.error(`item amount cannot go below 0`)
                return
            }
            break
    }
}