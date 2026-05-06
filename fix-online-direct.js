const fs = require('fs');
let content = fs.readFileSync('C:/dev/DarkFrame/components/chat/ChatPanel.tsx', 'utf8');

const oldOnlinePolling = [
  '  /**',
  '   * Poll for online count and user list every 30 seconds',
  '   */',
  '  const { data: onlineData } = usePolling<{ channelId: string; count: number; users?: Array<{ userId: string; username: string }> }>({',
  '    fetchFn: async () => {',
  '      const res = await fetch(`/api/chat/online?channelId=${activeChannel}`);',
  '      if (!res.ok) throw new Error(\'Failed to load online count\');',
  '      return res.json();',
  '    },',
  '    interval: 30000, // Poll every 30 seconds',
  '    enabled: true,',
  '    pauseWhenInactive: true,',
  '    onData: (data) => {',
  '      console.log(\'[ChatPanel] Online data received:\', JSON.stringify(data));',
  '      // Count is derived directly from onlineData?.count (avoiding stale closure)',
  '      ',
  '      // Update online users list for @mentions',
  '      if (data?.users && Array.isArray(data.users)) {',
  '        const mentionUsers: MentionUser[] = data.users',
  '          .filter((u) => u.userId !== userId) // Don\'t mention yourself',
  '          .map((u) => ({',
  '            id: u.userId,',
  '            display: u.username,',
  '          }));',
  '        setOnlineUsers(mentionUsers);',
  '      }',
  '    },',
  '  });',
].join('\n');

const newOnlinePolling = [
  '  /**',
  '   * Poll for online count and user list every 30 seconds (direct useEffect, bypasses usePolling)',
  '   */',
  '  const [onlineData, setOnlineDataLocal] = useState<{ channelId: string; count: number; users?: Array<{ userId: string; username: string }> } | null>(null);',
  '',
  '  useEffect(() => {',
  '    let active = true;',
  '    let timer: NodeJS.Timeout | null = null;',
  '',
  '    const fetchOnline = async () => {',
  '      try {',
  '        const res = await fetch(`/api/chat/online?channelId=${activeChannel}`);',
  '        if (!res.ok) throw new Error(\'Failed to load online count\');',
  '        const data = await res.json();',
  '        if (!active) return;',
  '        console.log(\'[ChatPanel] Online data received:\', data.onlineCount);',
  '        setOnlineDataLocal(data);',
  '        setOnlineCount(data.count ?? 0);',
  '',
  '        // Update online users list for @mentions',
  '        if (data?.users && Array.isArray(data.users)) {',
  '          const mentionUsers: MentionUser[] = data.users',
  '            .filter((u: any) => u.userId !== userId)',
  '            .map((u: any) => ({',
  '              id: u.userId,',
  '              display: u.username,',
  '            }));',
  '          setOnlineUsers(mentionUsers);',
  '        }',
  '      } catch (err) {',
  '        console.error(\'[ChatPanel] Online fetch failed:\', err);',
  '      }',
  '    };',
  '',
  '    fetchOnline();',
  '    timer = setInterval(fetchOnline, 30000);',
  '',
  '    return () => {',
  '      active = false;',
  '      if (timer) clearInterval(timer);',
  '    };',
  '  }, [activeChannel, userId]);',
].join('\n');

let replaced = content.replace(oldOnlinePolling, newOnlinePolling);
if (replaced === content) {
  console.log('WARNING: oldOnlinePolling not found, trying with LF');
  // The file has LF line endings, but the old pattern should match since I'm using \n
}
content = replaced;

// Fix: update currentOnlineCount to use onlineCount state (set directly in useEffect)
// and update onlineData references
const oldDerive = "console.log('[ChatPanel] Render: onlineData=', onlineData, 'onlineData?.count=', onlineData?.count);\n  const currentOnlineCount = typeof onlineData?.count === 'number' ? onlineData.count : 0;";
const newDerive = "console.log('[ChatPanel] Render: onlineCount=', onlineCount);\n  const currentOnlineCount = onlineCount;";
content = content.replace(oldDerive, newDerive);

// Remove the useEffect sync I added earlier since it's now unnecessary
const oldSync = "\n  // Sync onlineData from usePolling to onlineCount state whenever it changes\n  useEffect(() => {\n    if (typeof onlineData?.count === 'number') {\n      console.log('[ChatPanel] Syncing onlineData.count =', onlineData.count);\n      setOnlineCount(onlineData.count);\n    }\n  }, [onlineData?.count]);\n";
content = content.replace(oldSync, '\n');

fs.writeFileSync('C:/dev/DarkFrame/components/chat/ChatPanel.tsx', content, 'utf8');
console.log('Replaced online polling with direct useEffect pattern');
