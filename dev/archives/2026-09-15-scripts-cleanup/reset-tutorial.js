// Reset tutorial progress completely
// Run this in browser console, then refresh page

fetch('/api/tutorial', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'restart',
    playerId: '68f1b4f1ddd738e988e8c4ef'
  })
})
.then(r => r.json())
.then(result => {
  console.log('✅ Tutorial reset:', result);
  console.log('🔄 Refreshing page in 2 seconds...');
  setTimeout(() => window.location.reload(), 2000);
})
.catch(err => console.error('❌ Reset failed:', err));
