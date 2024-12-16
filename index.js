import { onMinuteAsync } from './src/service.js'
import { accounts, activities, assets, world, market, current, auth, blog } from './src/model.js'
import { app } from './src/api.js'
import session from 'express-session'
import * as util from './src/utility.js'

console.log(`starting worldcore service..`)
const port = 3000
app.listen(port, () => {
    console.log(`app listening on port ${port}`)
})

setInterval(onMinuteAsync, world.interval.minute)

app.get('/', (req, res) => {
    const session = req.session
    
    const username = req.query.user? req.query.user : req.session.username
    const account = accounts.find(a => a.id == username)

    const marketSoldStats = util.getStats(market.filter(l => l.times.sold).map(l => l.price))

    let listings = market.filter(l => !l.times.sold && !l.times.expired)
        .sort((a, b) => { return a.price < b.price ? 1 : -1})
        .sort((a, b) => { return a.amount < b.amount ? 1 : -1})
    const activeListingStats = util.getStats(listings.map(l => l.price))

    const marketStatsHtml = `
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
    `

    const headerHtml = `
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

            <small><strong>${session.username? `${session.username}</strong> (<a href="/exit">exit</a>)` : ``}</small>
        </div>

        ${!session.username ? `
            <h1 style="margin-top:.3em;margin-bottom:0px;"><small><a href="/">Bankstone</a></small></h1>
            <small>Web3 Currency & Digital Asset Platform</small>` : ``}

        <!--
        <ul style="padding:0;text-align:right"><small>
            <li><a href="/accounts">all accounts (${accounts.length})</a></li>
            <li>
                <a href="/activities?type=transaction">transactions (${activities.filter(a => a.type == "transaction").length})</a>
                <a href="/activities?type=mint">minted (${activities.filter(a => a.type == "mint").length})</a>
                <a href="/activities?type=collect">collects (${activities.filter(a => a.type == "collect").length})</a>
                <a href="/activities">all activities (${activities.length})</a>
            </li>
            <li><a href="/assets">assets (${assets.length} minted)</a></li>
            <li><a href="/auths">auths (${auth.length})</a></li>
        </small></ul>
        -->

        ${session.username && session.username == username ? `
            <form action="/collect?return=/?user=${username}" method="post">
                <input type="hidden" name="owner" value="${username}" />
                <button name="resource" value="water" ${current.resources.water.balance <= 0 ? "disabled": ""}>Collect water (5-10)</button>
                <button name="resource" value="mineral" ${current.resources.mineral.balance <= 0 ? "disabled": ""}>Collect mineral (1-3)</button>
            </form>`: ``
        }
    `

    if (!req.session.username && !req.query.user) {
        const balanceLeaders = accounts.sort((a, b) => {return a.credits.balance > b.credits.balance ? -1 : 1})
        let balanceLeaderHtml = "<p>Empty<p>"
        if (balanceLeaders.length > 0) {
            balanceLeaderHtml = "<ul>"
            balanceLeaders.slice(0, 100).forEach((a, idx) => {
                balanceLeaderHtml += `<oi><div>
                    <strong>${idx+1}.</strong>
                    <strong><a href="/?user=${a.id}">${a.id}</a></strong>
                    <small>(balance: ${a.credits.balance.toFixed(2)})</small>
                </div></oi>`
            })
            balanceLeaderHtml += "</ul>"
        }

        let blogHtml = blog.sort((a, b) => {return a.times.created > b.times.created ? -1 : 1})

        if (blog.length > 0) {
            blogHtml = "<ul>"
            blog.slice(0, 100).forEach((p, idx) => {
                blogHtml += `<oi><div>
                    <h3 style="margin-bottom:.1em">${p.title}</h3>
                    <small>${p.tags? `Tags: <span style="color:gray">${p.tags.join(", ")}</span> ` : ''}posted on ${`
                        Year ${Math.floor(p.times.created/(world.interval.hour * world.interval.day * world.interval.year))}
                        Day ${Math.floor(p.times.created/(world.interval.hour * world.interval.day))}
                        ${Math.floor(p.times.created%(world.interval.hour * world.interval.day)/(world.interval.hour))}:${current.time % (world.interval.hour) < 10 ? '0':''}${current.time % (world.interval.hour)}</a>`} by ${p.author}</small>
                    <p>${p.content}</p>
                </div></oi>`
            })
            balanceLeaderHtml += "</ul>"
        } else { `<p>Empty</p>` }

        res.send(`<html><body>
            ${headerHtml}
            <h2>Worldbank of Web3 Economy <small>(in active development)</small></h2>
            <h3>Collect resources from the new world. Craft and trade items! Receive Web3 credits before token launch!</h3>
            
            <form action="/auth" method="post">
                <h3 style="margin-bottom:1px">Login</h3>
                <div><small>
                    <input name="save" type="checkbox" />
                    <label for="save">Keep the access for next 7 days</label>
                </small></div>
                <div>
                    <input name="username" placeholder="username" required />
                    <input name="password" type="password" placeholder="password" required />
                    <button>Enter</button>
                </div>
            </form>

            <form action="/mint?return=/" method="post">
                <h3 style="margin-bottom:1px">Register</h3>
                <small>Invitation code is required at this time. Please check out <a href="https://github.com" target="_blank">project site</a> for more details.</small>
                <div>
                    <input name="invitecode" placeholder="invitation code" required />
                    <input name="username" placeholder="username" required />
                </div>
                <div>
                    <input name="password" type="password" placeholder="password" required />
                    <input name="confirm" type="password" placeholder="confirm" required />
                    <button name="type" value="account">Mint Account</button>
                </div>
            </form>

            <h2>Market Statistics</h2>
            ${marketStatsHtml}

            <h2>Leaderboard</h2>
            <div>
                <h4>Balance</h4>
                ${balanceLeaderHtml}
            </div>

            <h2>Blog</h2>
            <div>
                ${blogHtml}
            </div>

            <div><small>
                Interested in joining this open project?
                <a href="https://github.com" target="_blank">learn more</a>
            </small></div>
        </body></html>`)
        return
    }

    const items = assets.filter(a => a.owner == account.id && a.amount > 0)
        .sort((a, b) => { return a.properties && b.properties &&
            (a.properties.staked * a.properties.yield) > (b.properties.staked * b.properties.yield) ?
            1 : -1})
        .sort((a, b) => { return a.amount < b.amount ? 1 : -1})

    const userWaters = items.filter((a) => a.type=="water")
    const userWaterTotal = userWaters.reduce((sum, c) => {return sum + c.amount}, 0)

    const userMinerals = items.filter((a) => a.type=="mineral")
    const userMineralTotal = userMinerals.reduce((sum, c) => {return sum + c.amount}, 0)

    const userActiveBankstones = items.filter((a) => a.type=="bankstone" && current.effects.indexOf(a.id) >= 0)
    const activeEffectsTotal = current.effects.length

    const sendCreditHtml = `
        <form action="/transaction?return=/?user=${username}" method="post" style="text-align:right">
            <div style="margin-top:1em">
                <input type="hidden" name="from" value="${username}" />
                <input name="to" placeholder="receiver's username" required />
                <input name="amount" type="number" min=".01" max="1000.00" value=".01" step=".01" required />
                <button name="of" value="credit">Send</button>
            </div>
        </form>
        <form action="/post" method="post" style="text-align:right">
            <div>
                <label for="title">Title</label>
                <input name="title" placeholder="Title is required to post" required />
                <label for="tags">Tags</label>
                <input name="tags" placeholder="general, question, issue, ..." />
            </div>
            <textarea style="margin-bottom:.3em" name="content" rows="4" cols="60" placeholder="Each credit consumption on the post will be fully rewarded to content creator."></textarea>
            <div><button>Post (-10.00 credit)</button></div>
        </form>
    `

    let inventoryHtml = `<h3>Inventory (<a href="/assets?user=${username}">${items.filter(i => i.owner == username).length}</a>)</h3>`
    if (items.length > 0) {
        inventoryHtml += `
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
                        ${Math.ceil(current.resources.water.supplied*Math.log(accounts.length*accounts.length)/current.resources.mineral.supplied)}
                        water +
                        ${10} mineral +
                        ${100.00.toFixed(2)} credit</small>
                </div>
            </form>
        <ul>`
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
                            ${(i.type == "water" || i.type == "mineral") && i.amount < 100 ? "Sell (min.100)" : `Sell ${i.amount}`}
                        </button>
                        <input name="amount" type="hidden" value="${i.amount}" />
                        for <input name="price" type="number" value="${i.type == "bankstone" ?
                            (i.properties.staked * i.properties.yield * .33).toFixed(2) :
                            (i.amount * (i.type == 'water' ? .03 : .09)).toFixed(2)}" max="1000.00" step=".01" />
                        credit
                    </div>
                </form>
            </li>`
        })
        inventoryHtml += "</ul>"
    } else inventoryHtml += "<p>Empty. Collect resources or buy items from Marketplace<p>"


    if (session.username != username) listings = listings.filter(l => l.owner == username)
    let marketplaceHtml = `<h3 style="margin-bottom:0">Marketplace (<a href="/market?expired=false&sold=false">${listings.length}</a>)</h3>`
    if (listings.length > 0) {
        marketplaceHtml += `${marketStatsHtml}
        <ul>`
        listings.slice(0, 20).forEach(l => {
            const i = assets.find(a => a.id == l.item)
            marketplaceHtml += `<li>
                <form action="/trade?return=/?user=${username}" method="post">
                    <div>
                        ${l.amount}
                        unit of ${l.owner}'s ${i.type} ${i.type=="bankstone" ? ` <small>APR ${(i.properties.yield*100).toFixed(0)}% ${Math.floor(i.properties.staked)}/${i.properties.cap} (${(i.properties.staked/i.properties.cap * 100).toFixed(0)}%)</small>` : ``}
                        <small for="id">${l.id}</small>
                        <input name="id" type="hidden" value="${l.id}" />
                    </div>
                    <div>
                        <button name="buyer" value="${username}" ${!session.username && account.credits.balance < l.price ? `disabled` :``}>
                            ${session.username && l.owner == username ? 'Delist' : 'Buy'}</button>
                        for <input name="price" type="number" value="${l.price.toFixed(2)}" readonly /> credit
                    </div>
                </form>
            </li>`
        })
        marketplaceHtml += "</ul>"
    } else marketplaceHtml += `<p style="text-align:center">Nothing listed for sale at this time<p>`

    res.send(`<html><body>
        ${headerHtml}
        <h2 style="text-align:center;margin-bottom:.3em">${username}</h2>

        <div style="text-align:center">${session.username && session.username == username ? `
            <form action="/edit?return=/" method="post">
                <textarea name="bio" rows="3" cols="50" placeholder="Write description of this account.">${account.bio? account.bio:''}</textarea>
                <div style="margin-top:.3em"><button>Update Bio (-100.00 credit)</button></div>
            </form>
        `: `<p style="text-align:center">${account.bio? account.bio : `No description`}</p>`}
        </div>

        <div style="text-align:right"><small style="color:gray;margin-bottom:0">balance</small></div>
        <div style="text-align:right">
            <small style="color:${"#00A0FF"}"><strong>water</strong></small> ${userWaterTotal}<small style="color:${"#BBB"}">/${current.resources.water.supplied.toFixed(0)}(${(userWaterTotal/current.resources.water.supplied*100).toFixed(2)}%)</small>

            <small style="color:${"#FF03EA"}"><strong>mineral</strong></small> ${userMineralTotal}<small style="color:${"#BBB"}">/${current.resources.mineral.supplied.toFixed(0)}(${(userMineralTotal/current.resources.mineral.supplied*100).toFixed(2)}%)</small>
            <small style="color:${"gray"}"><strong>bankstones</strong></small> ${userActiveBankstones.length}<small style="color:${"#BBB"}">/${activeEffectsTotal}(${(userActiveBankstones.length/activeEffectsTotal*100).toFixed(2)}%)</small>
        </div>
        <div style="text-align:right">
            <h1 style="margin-top:.3em;margin-bottom:1px">
                ${account.credits.balance.toFixed(2)} <small style="color:gray"><small>credit</small></small>
            </h1>
            <small>
                holding ${(account.credits.balance/current.resources.credits.balance*100).toFixed(2)}% of
                ${current.resources.credits.balance.toFixed(2)} credits circulating..
            </small>
        </div>

        ${session && session.username == username ? sendCreditHtml : ``}
        ${session && session.username == username ? inventoryHtml : ``}

        ${marketplaceHtml}
        </body></html>`)
})