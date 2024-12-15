import { onMinuteAsync } from './src/service.js'
import { accounts, activities, assets, world, market, current } from './src/model.js'
import { app } from './src/api.js'
import * as util from './src/utility.js'

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

    const userWaters = items.filter((a) => a.type=="water")
    const userWaterTotal = userWaters.reduce((sum, c) => {return sum + c.amount}, 0)

    const userMinerals = items.filter((a) => a.type=="mineral")
    const userMineralTotal = userMinerals.reduce((sum, c) => {return sum + c.amount}, 0)

    const userBankstones = items.filter((a) => a.type=="bankstone")
    const bankstoneTotal = assets.filter(a => a.type == "bankstone").reduce((sum, c) => sum+=1, 0)

    let inventoryHtml = "<p>Empty<p>"
    if (items.length > 0) {
        inventoryHtml = "<ul>"
        items.slice(0, 20).forEach(i => {
            inventoryHtml += `<li>
                <form action="/list?return=/?user=${username}" method="post">
                    <div>
                        ${i.amount} unit of ${i.owner}'s ${i.type} ${i.type=="bankstone" ? ` <small>APR ${(i.properties.yield*100).toFixed(0)}% ${Math.floor(i.properties.staked)}/${i.properties.cap} (${(i.properties.staked/i.properties.cap * 100).toFixed(0)}%)</small>` : ``}
                        <small for="id">${i.id}</small>
                        <input name="id" type="hidden" value="${i.id}" />
                    </div>
                    <div>
                        <button name="owner" value="${username}"
                            ${(i.type == "water" || i.type == "mineral") && i.amount < 100 ? "disabled" : ""}>
                            Sell
                        </button>
                        <input name="amount" type="hidden" value="${i.amount}" />
                        for <input name="price" type="number" value="${i.type == "bankstone" ?
                            (i.properties.staked * i.properties.yield * .33).toFixed(2) :
                            (i.amount * .033).toFixed(2)}" max="1000.00" step=".01" />
                        credit
                    </div>
                </form>
            </li>`
        })
        inventoryHtml += "</ul>"
    }

    const marketSoldStats = util.getStats(market.filter(l => l.times.sold).map(l => l.price))

    const listings = market.filter(l => !l.times.sold && !l.times.expired)
        .sort((a, b) => { return a.price < b.price ? 1 : -1})
        .sort((a, b) => { return a.amount < b.amount ? 1 : -1})
    const activeListingStats = util.getStats(listings.map(l => l.price))

    let listingsHtml = "<p>Empty<p>"
    if (listings.length > 0) {
        listingsHtml = "<ul>"
        listings.slice(0, 20).forEach(l => {
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
        <div style="background:#EFEFEF;margin:0;padding:.5em">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="1em"><circle fill="#00A0FF" stroke="#00A0FF" stroke-width="30" r="15" cx="40" cy="65"><animate attributeName="cy" calcMode="spline" dur="1" values="65;135;65;" keySplines=".5 0 .5 1;.5 0 .5 1" repeatCount="indefinite" begin="-.4"></animate></circle><circle fill="#00C0FF" stroke="#00C0FF" stroke-width="30" r="15" cx="100" cy="65"><animate attributeName="cy" calcMode="spline" dur="1" values="65;135;65;" keySplines=".5 0 .5 1;.5 0 .5 1" repeatCount="indefinite" begin="-.2"></animate></circle><circle fill="#00C0FF" stroke="#00C0FF" stroke-width="30" r="15" cx="160" cy="65"><animate attributeName="cy" calcMode="spline" dur="1" values="65;135;65;" keySplines=".5 0 .5 1;.5 0 .5 1" repeatCount="indefinite" begin="0"></animate></circle></svg>
            <small style="color:${"#00A0FF"}"><strong>water</strong></small>
            <span style="color:${"#000"}">${current.resources.water.balance.toFixed(0)}</span>

            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="1em"><path fill="#FF03EA" stroke="#FF03EA" stroke-width="30" transform-origin="center" d="m148 84.7 13.8-8-10-17.3-13.8 8a50 50 0 0 0-27.4-15.9v-16h-20v16A50 50 0 0 0 63 67.4l-13.8-8-10 17.3 13.8 8a50 50 0 0 0 0 31.7l-13.8 8 10 17.3 13.8-8a50 50 0 0 0 27.5 15.9v16h20v-16a50 50 0 0 0 27.4-15.9l13.8 8 10-17.3-13.8-8a50 50 0 0 0 0-31.7Zm-47.5 50.8a35 35 0 1 1 0-70 35 35 0 0 1 0 70Z"><animateTransform type="rotate" attributeName="transform" calcMode="spline" dur="3.5" values="0;120" keyTimes="0;1" keySplines="0 0 1 1" repeatCount="indefinite"></animateTransform></path></svg>
            <small style="color:${"#FF03EA"}"><strong>mineral</strong></small>
            <span style="color:${"#000"}">${current.resources.mineral.balance.toFixed(0)}</span></span>

            <small style="margin-left:1em">
                <svg width="1em" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="FF0000" stroke="FF0000" d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,20a9,9,0,1,1,9-9A9,9,0,0,1,12,21Z"/><rect x="11" y="6" rx="1" width="2" height="7"><animateTransform attributeName="transform" type="rotate" dur="15s" values="0 12 12;360 12 12" repeatCount="indefinite"/></rect><rect x="11" y="11" rx="1" width="2" height="9"><animateTransform attributeName="transform" type="rotate" dur="1s" values="0 12 12;360 12 12" repeatCount="indefinite"/></rect></svg><small style="color:gray">x${60000/world.interval.minute}</small>
                Year ${Math.floor(current.time/(world.interval.hour * world.interval.day * world.interval.year))}
                Day ${Math.floor(current.time/(world.interval.hour * world.interval.day))}
                <a href="/current">${Math.floor(current.time%(world.interval.hour * world.interval.day)/(world.interval.hour))}:${current.time % (world.interval.hour) < 10 ? '0':''}${current.time % (world.interval.hour)}</a>
                <small>(${(current.time % (world.interval.hour)/world.interval.hour*100).toFixed(0)}% to yield)</small>
            </small>
        </div>
        <ul>
            <li><a href="/accounts">all accounts (${accounts.length})</a></li>
            <li>
                <a href="/activities?type=transaction">transactions (${activities.filter(a => a.type == "transaction").length})</a>
                <a href="/activities?type=mint">minted (${activities.filter(a => a.type == "mint").length})</a>
                <a href="/activities?type=collect">collects (${activities.filter(a => a.type == "collect").length})</a>
                <a href="/activities">all activities (${activities.length})</a>
            </li>
            <li><a href="/assets">assets (${assets.length} minted)</a></li>
        </ul>

        <form action="/collect?return=/?user=${username}" method="post">
            <input type="hidden" name="owner" value="${username}" />
            <button name="resource" value="water" ${current.resources.water.balance <= 0 ? "disabled": ""}>Collect water (5-10)</button>
            <button name="resource" value="mineral" ${current.resources.mineral.balance <= 0 ? "disabled": ""}>Collect mineral (1-3)</button>
        </form>
        <div>
            <small style="color:${"#00A0FF"}"><strong>water</strong></small> ${userWaterTotal}<small style="color:${"#BBB"}">/${current.resources.water.supplied.toFixed(0)}(${(userWaterTotal/current.resources.water.supplied).toFixed(2)}%)</small>

            <small style="color:${"#FF03EA"}"><strong>mineral</strong></small> ${userMineralTotal}<small style="color:${"#BBB"}">/${current.resources.mineral.supplied.toFixed(0)}(${(userMineralTotal/current.resources.mineral.supplied).toFixed(2)}%)</small>
            <small style="color:${"gray"}"><strong>bankstones</strong></small> ${userBankstones.length}<small style="color:${"#BBB"}">/${bankstoneTotal}(${(userBankstones.length/bankstoneTotal).toFixed(2)}%)</small>
        </div>
        <form action="/transaction?return=/?user=${username}" method="post" style="text-align:right">
            <small style="color:gray"><strong>${username}</strong>'s balance</small>
            <h1 style="margin-top:0;margin-bottom:0">${account.credits.balance.toFixed(2)} <small>credit</small></h1>
            <small>
                holding ${(account.credits.balance/current.resources.credits.supplied*100).toFixed(2)}% of
                ${current.resources.credits.supplied.toFixed(2)} credits circulating..
            </small>
            <div style="margin-top:1em">
                <input type="hidden" name="from" value="${username}" />
                <input name="to" placeholder="receiver's username" required />
                <input name="amount" type="number" min=".01" max="1000.00" value=".01" step=".01" required />
                <button name="of" value="credit">Send</button>
            </div>
        </form>

        <h3>Inventory (<a href="/assets?user=${username}">${items.filter(i => i.owner == username).length}</a>)</h3>
        <form action="/mint?return=/?user=${username}" method="post">
            <div>
                <input type="hidden" name="owner" value="${username}" />
                
                <button name="type" value="bankstone"
                    ${userMinerals < 1 ||
                    userWaters < Math.ceil(current.resources.water.supplied/current.resources.mineral.supplied) ||
                    account.credits.balance < 100 ? "disabled": ""}>
                    Mint Bankstone
                </button>
                <small for="type">
                    consumes
                    ${Math.ceil(current.resources.water.supplied*Math.log(accounts.length)/current.resources.mineral.supplied)}
                    water +
                    ${1} mineral +
                    ${100.00.toFixed(2)} credit</small>
            </div>
        </form>
        <form action="/mint?return=/?user=${username}" method="post">
            <input name="username" placeholder="username" required />
            <button name="type" value="account">Mint Account</button>
        </form>
        ${inventoryHtml}

        <h3 style="margin-bottom:0">Marketplace (<a href="/market?expired=false&sold=false">${market.filter(l => !l.times.expired && !l.times.sold).length}</a>)</h3>
        <div>
            <small>total ${activeListingStats.count} (${activeListingStats.sum.toFixed(0)} credit) selling at
            avg. ${activeListingStats.mean.toFixed(2)}
            mdn. ${activeListingStats.median.toFixed(2)}
            </small>
        </div>
        <div>
            <small>total ${marketSoldStats.count} (${marketSoldStats.sum.toFixed(2)} credit) sold at
            avg. ${marketSoldStats.mean.toFixed(2)}
            mdn. ${marketSoldStats.median.toFixed(2)}
            </small>
        </div>
        ${listingsHtml}
        `)
})