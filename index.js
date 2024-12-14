import { onMinuteAsync } from './src/service.js'
import { accounts, activities, assets, world, market, current } from './src/model.js'
import { app } from './src/api.js'

console.log(`starting worldcore service..`)
const port = 3000
app.listen(port, () => {
    console.log(`app listening on port ${port}`)
})

setInterval(onMinuteAsync, world.interval.minute)

app.get('/', (req, res) => {
    const username = req.query.user ? req.query.user : "world"
    const account = accounts.find(a => a.id == username)

    const items = assets.filter(a => a.owner == account.id && a.amount > 0)
        .sort((a, b) => { return a.properties && b.properties &&
            (a.properties.staked * a.properties.yield) > (b.properties.staked * b.properties.yield) ?
            1 : -1})
        .sort((a, b) => { return a.amount < b.amount ? 1 : -1})

    const userWaters = assets.filter((a) => a.type=="water")
    const userMinerals = assets.filter((a) => a.type=="mineral")
    const userBankstones = assets.filter((a) => a.type=="bankstone")

    let inventoryHtml = "<p>Empty<p>"
    if (items.length > 0) {
        inventoryHtml = "<ul>"
        items.forEach(i => {
            inventoryHtml += `<li>
                <form action="/sell?return=/?user=${username}" method="post">
                    <div>
                        ${i.amount} unit of ${i.type} ${i.type=="bankstone" ? ` <small>APR ${(i.properties.yield*100).toFixed(0)}% ${Math.floor(i.properties.staked)}/${i.properties.cap} (${(i.properties.staked/i.properties.cap * 100).toFixed(0)}%)</small>` : ``}
                        <small for="id">${i.id}</small>
                        <input name="id" type="hidden" value="${i.id}" />
                    </div>
                    <div>
                        <button name="owner" value="${username}" ${(i.type == "water" || i.type == "mineral") && i.amount < 100 ? "disabled" : ""}>Sell</button>
                        <input name="amount" type="number" value="${i.amount}" required readonly /> units
                        for <input name="price" type="number" value="${i.type == "bankstone" ? i.staked * i.yield * 2 : i.amount * 1}" max="1000.00" step=".01" /> credit
                    </div>
                </form>
            </li>`
        })
        inventoryHtml += "</ul>"
    }

    const listings = market.filter(a => !a.times.sold && !a.times.expired)
    let listingsHtml = "<p>Empty<p>"
    if (listings.length > 0) {
        listingsHtml = "<ul>"
        listings.forEach(l => {
            const i = assets.find(a => a.id == l.item)
            listingsHtml += `<li>
                <form action="/trade?return=/?user=${username}" method="post">
                    <div>
                        ${l.amount}
                        unit of ${l.owner}'s ${i.type} ${i.type=="bankstone" ? ` <small>APR ${(i.properties.yield*100).toFixed(0)}% ${Math.floor(i.properties.staked)}/${i.properties.cap} (${(i.properties.staked/i.properties.cap * 100).toFixed(0)}%)</small>` : ``}
                        <small for="id">${l.id}</small>
                        <input name="id" type="hidden" value="${l.id}" />
                    </div>
                    <div>
                        <button name="buyer" value="${username}">Buy</button>
                        for <input name="price" type="number" value="${Number(l.price).toFixed(2)}" readonly /> credit
                    </div>
                </form>
            </li>`
        })
        listingsHtml += "</ul>"
    }

    res.send(`
        <h1><a href="/">Worldcore</a></h1>
        <h4>
            <a href="/current">
                Year ${Math.floor(current.time/(world.interval.hour * world.interval.day * world.interval.year))}
                Day ${Math.floor(current.time/(world.interval.hour * world.interval.day))}
                ${Math.floor(current.time%(world.interval.hour * world.interval.day)/(world.interval.hour))}:${current.time % (world.interval.hour)}
            </a>
            Water: ${current.resources.water.balance.toFixed(0)}
             - Mineral: ${current.resources.mineral.balance.toFixed(0)}
             - Credits: ${current.resources.credits.balance.toFixed(2)}
        </h4>
        <ul>
            <li><a href="/accounts">accounts (${accounts.length})</a></li>
            <li><a href="/activities">activities (${activities.length})</a></li>
            <li><a href="/assets">assets (${assets.length} minted)</a></li>
        </ul>

        <h3>${username}'s balance: ${account.credits.balance.toFixed(2)} credit</h3>
        <h4>
            Water: ${userWaters.length > 0 ? userWaters.reduce((sum, c) => {return sum + c.amount}, 0): 0} units
            Mineral: ${userMinerals.length > 0 ? userMinerals.reduce((sum, c) => {return sum + c.amount}, 0): 0} units
            Bankstones: ${userBankstones.length > 0 ? userBankstones.reduce((sum, c) => {return sum + c.amount}, 0): 0} units
        </h4>
        <form action="/transaction?return=/?user=${username}" method="post">
            <input type="hidden" name="from" value="${username}" />
            <input name="to" placeholder="receiver's username" required />
            <input name="amount" type="number" min=".01" max="1000.00" value=".01" step=".01" required />
            <button name="of" value="credit">Send</button>
        </form>
        <form action="/collect?return=/?user=${username}" method="post">
            <input type="hidden" name="owner" value="${username}" />
            <button name="resource" value="water">Collect Water (5-10)</button>
            <button name="resource" value="mineral">Collect Mineral (1-3)</button>
        </form>

        <h3>Inventory (<a href="/assets?user=${username}">${items.filter(i => i.owner == username).length}</a>)</h3>
        <form action="/mint?return=/?user=${username}" method="post">
            <!--<div>
                <label for="water">Water</label>
                <input type="range" name="water" min="10" max="1000" value="10" width="4" />
                <br />
                <label for="mineral">Mineral</label>
                <input type="range" name="mineral" min="1" max="10" value="1" width="4" readonly />
            </div>-->
            <div>
                <input type="hidden" name="owner" value="${username}" />
                <button name="type" value="bankstone">Mint Bankstone</button>
            </div>
        </form>
        <form action="/mint?return=/?user=${username}" method="post">
            <input name="username" placeholder="username" required />
            <button name="type" value="account">Mint Account</button>
        </form>
        ${inventoryHtml}

        <h3>Marketplace (<a href="/market?expired=false&sold=false">${market.filter(l => !l.times.expired && !l.times.sold).length}</a>)</h3>
        ${listingsHtml}
        `)
})