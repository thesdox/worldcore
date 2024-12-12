import { join } from 'path'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node';

// Use JSON file for storage
const adapter = new JSONFile("./world.json")
const db = new Low(adapter, {})

// Read data from JSON file, this will set db.data content
const world = await db.read()
console.log(world);

console.log(`starting worldcore service..`)

setInterval(() => {
    console.log(`interval..`)

}, 2000)