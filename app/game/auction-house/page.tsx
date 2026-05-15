'use client';

import React, { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';
import { Search, Filter, Clock, Coins, TrendingUp, Package, Gavel, ChevronDown, Star } from 'lucide-react';

interface AuctionListing {
  id: string;
  itemName: string;
  itemType: string;
  rarity: string;
  quantity: number;
  currentBid: number;
  buyoutPrice: number;
  seller: string;
  timeRemaining: string;
  icon: string;
}

export default function AuctionHousePage() {
  const { player } = useGameContext();
  const [activeTab, setActiveTab] = useState<'browse' | 'sell' | 'my-listings'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'units' | 'resources' | 'items'>('all');
  const [listings, setListings] = useState<AuctionListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const response = await fetch('/api/auction/listings');
        if (response.ok) {
          const data = await response.json();
          setListings(data.listings || []);
        }
      } catch (error) {
        console.error('Failed to fetch auction listings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, []);

  const filteredListings = listings.filter(l => {
    if (filterType !== 'all' && l.itemType !== filterType) return false;
    if (searchQuery && !l.itemName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getRarityColor = (rarity: string) => {
    const colors: Record<string, string> = {
      Common: 'text-white/50',
      Uncommon: 'text-[--synth]',
      Rare: 'text-[--electric]',
      Epic: 'text-[--neon-pink]',
      Legendary: 'text-[--neon-yellow]',
    };
    return colors[rarity] || 'text-white/50';
  };

  return (
    <>
      <TopNavBar onFriendsClick={() => {}} />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void] p-4">
            <div className="max-w-6xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-[--electric] flex items-center gap-3">
                    <Gavel className="w-8 h-8" />
                    Auction House
                  </h1>
                  <p className="text-white/50 mt-1">Buy and sell items with other players</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-[--card] border border-[--border] rounded-lg px-4 py-2">
                    <div className="text-xs text-white/40">Your Balance</div>
                    <div className="text-lg font-bold text-[--solar]">{(player?.resources?.metal || 0).toLocaleString()} Metal</div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                {(['browse', 'sell', 'my-listings'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-5 py-2 rounded-lg font-semibold text-sm transition-colors ${
                      activeTab === tab
                        ? 'bg-[--electric]/15 border border-[--electric]/25 text-[--electric]'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}>
                    {tab === 'browse' && <><Search className="w-4 h-4 inline mr-1" /> Browse</>}
                    {tab === 'sell' && <><TrendingUp className="w-4 h-4 inline mr-1" /> Sell</>}
                    {tab === 'my-listings' && <><Package className="w-4 h-4 inline mr-1" /> My Listings</>}
                  </button>
                ))}
              </div>

              {activeTab === 'browse' && (
                <>
                  {/* Search & Filter */}
                  <div className="flex gap-3 mb-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input type="text" placeholder="Search items..." value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[--card] border border-[--border] rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[--electric]/30 text-sm" />
                    </div>
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <select value={filterType} onChange={(e) => setFilterType(e.target.value as typeof filterType)}
                        className="pl-10 pr-8 py-2.5 bg-[--card] border border-[--border] rounded-lg text-white text-sm focus:outline-none appearance-none cursor-pointer">
                        <option value="all">All Types</option>
                        <option value="units">Units</option>
                        <option value="resources">Resources</option>
                        <option value="items">Items</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    </div>
                  </div>

                  {/* Listings Grid */}
                  {loading ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[--electric]" />
                    </div>
                  ) : filteredListings.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredListings.map(listing => (
                        <div key={listing.id} className="bg-[--card] border border-[--border] rounded-lg p-4 hover:border-[--electric]/20 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{listing.icon}</span>
                              <div>
                                <h4 className={`font-bold text-sm ${getRarityColor(listing.rarity)}`}>{listing.itemName}</h4>
                                <p className="text-xs text-white/40">{listing.rarity} · {listing.itemType}</p>
                              </div>
                            </div>
                            {listing.quantity > 1 && (
                              <span className="text-xs bg-white/5 border border-[--border] rounded px-2 py-0.5 text-white/60">×{listing.quantity}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[--border]">
                            <div>
                              <div className="text-xs text-white/40">Current Bid</div>
                              <div className="text-sm font-bold text-[--solar]">{listing.currentBid.toLocaleString()}</div>
                            </div>
                            {listing.buyoutPrice > 0 && (
                              <button className="px-3 py-1.5 bg-[--electric]/15 text-[--electric] rounded text-xs font-semibold hover:bg-[--electric]/25 transition-colors">
                                Buyout {listing.buyoutPrice.toLocaleString()}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-2 text-xs text-white/30">
                            <span>by {listing.seller}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{listing.timeRemaining}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20">
                      <Gavel className="w-16 h-16 mx-auto mb-4 text-white/10" />
                      <p className="text-lg text-white/40 mb-2">No listings found</p>
                      <p className="text-sm text-white/30">Be the first to list an item for sale!</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'sell' && (
                <div className="bg-[--card] border border-[--border] rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">List an Item for Sale</h3>
                  <p className="text-sm text-white/40 mb-6">Select an item from your inventory to list on the auction house. You'll receive the sale price minus a 5% fee.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-white/60 mb-1">Select Item</label>
                      <select className="w-full px-4 py-2.5 bg-[--void] border border-[--border] rounded-lg text-white text-sm focus:outline-none">
                        <option value="">Choose an item...</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-white/60 mb-1">Starting Bid (Metal)</label>
                        <input type="number" placeholder="0" className="w-full px-4 py-2.5 bg-[--void] border border-[--border] rounded-lg text-white text-sm focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm text-white/60 mb-1">Buyout Price (Metal)</label>
                        <input type="number" placeholder="Optional" className="w-full px-4 py-2.5 bg-[--void] border border-[--border] rounded-lg text-white text-sm focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-1">Duration</label>
                      <select className="w-full px-4 py-2.5 bg-[--void] border border-[--border] rounded-lg text-white text-sm focus:outline-none">
                        <option value="12">12 Hours</option>
                        <option value="24">24 Hours</option>
                        <option value="48">48 Hours</option>
                      </select>
                    </div>
                    <button className="w-full py-3 bg-[--electric]/15 border border-[--electric]/25 text-[--electric] rounded-lg font-bold text-sm hover:bg-[--electric]/25 transition-colors">
                      List Item for Sale
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'my-listings' && (
                <div className="bg-[--card] border border-[--border] rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">My Listings</h3>
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 mx-auto mb-3 text-white/10" />
                    <p className="text-white/40">You have no active listings</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        }
      />
    </>
  );
}
