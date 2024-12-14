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

    const items = assets.filter(a => a.owner == account.id && a.amount > 0).sort((a, b) => {
        return a.properties && b.properties ?
            (a.properties.staked * a.properties.yield) > (b.properties.staked * b.properties.yield) ?
            -1:1:1
     })
    let inventoryHtml = "<p>Empty<p>"
    if (items.length > 0) {
        inventoryHtml = "<ul>"
        items.forEach(i => {
            inventoryHtml += `<li>
                <form action="/sell?return=/?user=${username}" method="post">
                    <div>
                        ${i.amount} unit of ${i.type} ${i.type=="bankstone" ? ` <small>APR ${(i.properties.yield*100).toFixed(0)}% ${Math.floor(i.properties.staked)}/${i.properties.cap} (${(i.properties.staked/i.properties.cap * 100).toFixed(0)}%)</small>` : ``}
                    </div>
                    <div>
                        <button name="id" value="${i.id}">Sell</button>
                        ${i.type=="water" || i.type=="mineral" ? `<input name="amount" type="number" value="100" disabled readonly /> units`: ``}
                        for <input name="price" type="number" value="1.00" max="1000.00" step=".01" /> credit
                        <input name="owner" type="hidden" value="${username}" />
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
                        ${l.amount} unit of ${i.type} ${i.type=="bankstone" ? ` <small>APR ${(i.properties.yield*100).toFixed(0)}% ${Math.floor(i.properties.staked)}/${i.properties.cap} (${(i.properties.staked/i.properties.cap * 100).toFixed(0)}%)</small>` : ` (${i.amount} units)`}
                    </div>
                    <div>
                        <button name="id" value="${i.id}">Buy</button>
                        for <input name="price" type="number" value="${Number(l.price).toFixed(2)}" disabled readonly /> credit
                        from ${l.owner}
                        <input name="buyer" type="hidden" value="${username}" />
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

        <form action="/transaction?return=/?user=${username}" method="post">
            <h3>${username}'s balance: ${account.credits.balance.toFixed(2)} credit</h3>
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

        <h3>Inventory (<a href="/assets?user=${username}">${items.length}</a>)</h3>
        ${inventoryHtml}

        <h3>Marketplace (<a href="/market">${market.length}</a>)</h3>
        ${listingsHtml}

        <h2>Mint account</h2>
        <form action="/mint?return=/?user=${username}" method="post">
            <input name="username" placeholder="username" required />
            <button name="type" value="account">Mint</button>
        </form>

        <h2>Mint items</h2>
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
        `)
})