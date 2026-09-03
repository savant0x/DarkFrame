/**
 * @file context/ChatPanelContext.tsx
 * @created 2025-10-26
 * @overview Context for sharing chat panel size state across components
 */

'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type ChatPanelSize = 'full' | 'half' | 'minimal';

interface ChatPanelContextType {
  panelSize: ChatPanelSize;
  setPanelSize: (size: ChatPanelSize) => void;
}

const ChatPanelContext = createContext<ChatPanelContextType | undefined>(undefined);

export function ChatPanelProvider({ children }: { children: ReactNode }) {
  const [panelSize, setPanelSize] = useState<ChatPanelSize>('full');

  return (
    <ChatPanelContext.Provider value={{ panelSize, setPanelSize }}>
      {children}
    </ChatPanelContext.Provider>
  );
}

export function useChatPanelSize() {
  const context = useContext(ChatPanelContext);
  if (!context) {
    throw new Error('useChatPanelSize must be used within ChatPanelProvider');
  }
  return context;
}
