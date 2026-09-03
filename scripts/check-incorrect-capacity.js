const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  await client.connect();
  const db = client.db('darkframe');
  
  const factories = await db.collection('factories').find({
    $expr: {
      $ne: [
        '$slots',
        {
          $add: [
            5000,
            {
              $multiply: [
                500,
                {
                  $subtract: [
                    { $ifNull: ['$level', 1] },
                    1
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  }).toArray();
  
  console.log(`Found ${factories.length} factories with incorrect capacity:\n`);
  
  factories.forEach(f => {
    const level = f.level || 1;
    const expected = 5000 + 500 * (level - 1);
    console.log(`Factory at (${f.x}, ${f.y})`);
    console.log(`  Owner: ${f.owner || 'None'}`);
    console.log(`  Level: ${level}`);
    console.log(`  Actual slots: ${f.slots}`);
    console.log(`  Expected: ${expected}`);
    console.log(`  UsedSlots: ${f.usedSlots || 0}`);
    console.log(`  LastSlotRegen: ${f.lastSlotRegen ? new Date(f.lastSlotRegen).toISOString() : 'N/A'}`);
    console.log('');
  });
  
  await client.close();
})();
