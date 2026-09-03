const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  await client.connect();
  const db = client.db('darkframe');
  
  const result = await db.collection('factories').updateMany(
    {
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
    },
    [
      {
        $set: {
          slots: {
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
        }
      },
      {
        $set: {
          usedSlots: {
            $cond: [
              { $gt: [{ $ifNull: ['$usedSlots', 0] }, '$slots'] },
              '$slots',
              { $ifNull: ['$usedSlots', 0] }
            ]
          }
        }
      }
    ]
  );
  
  console.log(`✅ Fixed ${result.modifiedCount} factories with incorrect capacity`);
  console.log(`   Matched: ${result.matchedCount}`);
  
  await client.close();
})();
