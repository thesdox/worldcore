import { JSONFilePreset } from 'lowdb/node'

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

setInterval(async () => {
    console.log(`current: T${current.time}`)
    console.log(`active accounts: ${current.accounts.length}/${accounts.length} transactions: ${activities.length}/${activities.length}`)
    const startTime = new Date().getTime()

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
                default:
                    break
            }

            activity.times.completed = current.time
            current.activities.completed.push(activity.id)
            current.activities.pending = current.activities.pending.filter(id => id !== activity.id)
        }
    })
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