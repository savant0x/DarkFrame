# Sprint 2: End-to-End Testing Checklist

> **FID-20251026-019 - Task 30: Comprehensive Testing**  
> **Created:** 2025-10-26  
> **Purpose:** Validate all Sprint 2 features (Chat Enhancements, Private Messaging, Friend System)

---

## 📋 **TESTING OVERVIEW**

**Sprint 2 Components:**
- ✅ Phase 1: Chat Enhancements (12 features)
- ✅ Phase 2: Private Messaging (5 tasks)
- ✅ Phase 3: Friend System (5 tasks)

**Total Test Cases:** 48  
**Estimated Testing Time:** 3-4 hours

---

## 🧪 **PHASE 1: CHAT ENHANCEMENTS TESTING**

### **1.1 Profanity Filter** (5 test cases)

**Test 1.1.1: Basic Profanity Replacement**
- [ ] Send message: "This is fucking amazing"
- [ ] Expected: Message displays as "This is ****ing amazing"
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.1.2: Multiple Profanity Words**
- [ ] Send message: "damn this shit is crazy"
- [ ] Expected: Message displays as "**** this **** is crazy"
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.1.3: Case Insensitive Detection**
- [ ] Send message: "FUCK this SHIT"
- [ ] Expected: Message displays as "**** this ****"
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.1.4: Profanity in URLs (Should Not Filter)**
- [ ] Send message: "https://example.com/fucking-great"
- [ ] Expected: URL NOT filtered (URLs should remain intact)
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.1.5: Clean Messages Unchanged**
- [ ] Send message: "This is a clean message"
- [ ] Expected: Message unchanged
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

### **1.2 Spam Detection** (6 test cases)

**Test 1.2.1: Rate Limiting (5 messages in 10 seconds)**
- [ ] Send 6 messages rapidly (within 10 seconds)
- [ ] Expected: 6th message rejected with rate limit error
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.2.2: Duplicate Message Detection**
- [ ] Send "test message" twice within 30 seconds
- [ ] Expected: 2nd identical message rejected
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.2.3: Excessive Caps Detection**
- [ ] Send message: "THIS IS ALL CAPS MESSAGE HELLO"
- [ ] Expected: Message rejected or warned (>70% caps)
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.2.4: Warning System (Strike 1)**
- [ ] Trigger spam detection
- [ ] Expected: Warning message "Strike 1/3" displayed
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.2.5: Warning System (Strike 2)**
- [ ] Trigger spam detection again
- [ ] Expected: Warning message "Strike 2/3" displayed
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.2.6: 24h Ban (Strike 3)**
- [ ] Trigger spam detection third time
- [ ] Expected: "Banned for 24 hours" message, cannot send messages
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

### **1.3 @Mentions System** (5 test cases)

**Test 1.3.1: Mention Autocomplete**
- [ ] Type "@" in chat input
- [ ] Expected: Autocomplete dropdown appears with online players
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.3.2: Mention Autocomplete Filtering**
- [ ] Type "@joh"
- [ ] Expected: Dropdown filters to players starting with "joh"
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.3.3: Mention Highlighting**
- [ ] Send message: "@username hello there"
- [ ] Expected: "@username" highlighted in cyan/blue color
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.3.4: Click Mention to Open DM**
- [ ] Click on "@username" in a message
- [ ] Expected: DM panel opens with that user
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.3.5: Mention Notification (Recipient)**
- [ ] Have another user mention you
- [ ] Expected: Notification/badge appears (if implemented)
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

### **1.4 URL Auto-Linking** (4 test cases)

**Test 1.4.1: HTTP URL Detection**
- [ ] Send message: "Check http://example.com"
- [ ] Expected: URL becomes clickable link
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.4.2: HTTPS URL Detection**
- [ ] Send message: "Visit https://github.com"
- [ ] Expected: URL becomes clickable link
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.4.3: Multiple URLs in Message**
- [ ] Send message: "See http://example.com and https://github.com"
- [ ] Expected: Both URLs clickable
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.4.4: URL Opens in New Tab**
- [ ] Click on a URL link
- [ ] Expected: Opens in new browser tab (target="_blank")
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

### **1.5 Edit/Delete Messages** (6 test cases)

**Test 1.5.1: Edit Button Appears (Own Message)**
- [ ] Send a message
- [ ] Expected: Edit button (pencil icon) visible on your own message
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.5.2: Edit Message Within 15 Minutes**
- [ ] Click edit button within 15 minutes
- [ ] Edit message text and save
- [ ] Expected: Message updates, shows "(edited)" label
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.5.3: Edit Window Expired (> 15 minutes)**
- [ ] Try to edit message older than 15 minutes
- [ ] Expected: Edit button disabled or shows error
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.5.4: Delete Button Appears (Own Message)**
- [ ] Hover over your own message
- [ ] Expected: Delete button (trash icon) visible
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.5.5: Delete Message with Confirmation**
- [ ] Click delete button
- [ ] Expected: Confirmation modal appears
- [ ] Click confirm
- [ ] Expected: Message deleted from chat
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 1.5.6: Cancel Delete Action**
- [ ] Click delete button
- [ ] Click cancel in confirmation modal
- [ ] Expected: Message NOT deleted
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

## 💬 **PHASE 2: PRIVATE MESSAGING TESTING**

### **2.1 DM Send/Receive** (5 test cases)

**Test 2.1.1: Open DM Panel**
- [ ] Click "Messages" button in TopNavBar
- [ ] Expected: ChatPanel switches to DM mode
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 2.1.2: Search for Player**
- [ ] In DM mode, use player search
- [ ] Type username
- [ ] Expected: Player appears in search results
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 2.1.3: Send First DM**
- [ ] Click on player from search
- [ ] Send message: "Hello, first DM!"
- [ ] Expected: Message appears in conversation
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 2.1.4: Receive DM (Recipient)**
- [ ] Have another player send you a DM
- [ ] Expected: Message appears in your conversation list
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 2.1.5: DM Conversation Persistence**
- [ ] Close DM panel, reopen
- [ ] Expected: Previous conversation still visible
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

### **2.2 DM Unread Counts** (4 test cases)

**Test 2.2.1: Unread Badge on TopNavBar**
- [ ] Receive a new DM while panel closed
- [ ] Expected: Red badge with count on Messages button
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 2.2.2: Unread Badge Updates**
- [ ] Receive 2 more DMs
- [ ] Expected: Badge count increases to 3
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 2.2.3: Mark as Read (Open Conversation)**
- [ ] Click on conversation with unread messages
- [ ] Expected: Unread badge decreases or disappears
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 2.2.4: Conversation Unread Indicator**
- [ ] Look at conversation list
- [ ] Expected: Conversations with unread messages highlighted/bolded
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

### **2.3 DM Delete** (3 test cases)

**Test 2.3.1: Delete Own DM**
- [ ] Send a DM, then delete it
- [ ] Expected: Message removed from conversation
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 2.3.2: Delete Shows Confirmation**
- [ ] Click delete on DM
- [ ] Expected: Confirmation prompt appears
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 2.3.3: Cannot Delete Other's Messages**
- [ ] Try to delete message sent by other player
- [ ] Expected: Delete button not visible on their messages
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

### **2.4 Player Search** (3 test cases)

**Test 2.4.1: Search by Username**
- [ ] Use player search, type partial username
- [ ] Expected: Matching players appear
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 2.4.2: Search Results Show Level/VIP**
- [ ] Look at search results
- [ ] Expected: Player level and VIP status visible
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 2.4.3: Empty Search Shows Recent**
- [ ] Clear search input
- [ ] Expected: Recent conversations displayed
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

## 👥 **PHASE 3: FRIEND SYSTEM TESTING**

### **3.1 Send Friend Requests** (5 test cases)

**Test 3.1.1: Open Friends Panel**
- [ ] Click "Friends" button in TopNavBar
- [ ] Expected: Friends panel opens (bottom-right overlay)
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.1.2: Click Add Friend**
- [ ] Click "Add Friend" button in panel header
- [ ] Expected: AddFriendModal opens (full-screen modal)
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.1.3: Search for User**
- [ ] Type username in search box
- [ ] Expected: User appears in search results (debounced 500ms)
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.1.4: Send Request with Message**
- [ ] Click "Add Friend" on search result
- [ ] Type optional message (max 200 chars)
- [ ] Click "Send Request"
- [ ] Expected: Request sent, "Pending" status shown
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.1.5: Cannot Send Duplicate Request**
- [ ] Try to send another request to same user
- [ ] Expected: Button shows "Pending" and is disabled
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

### **3.2 Accept/Decline Requests** (6 test cases)

**Test 3.2.1: Pending Request Badge**
- [ ] Have another user send you a friend request
- [ ] Expected: Amber badge on Friends button with count
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.2.2: View Received Requests**
- [ ] Open Friends panel
- [ ] Click "Received" tab in FriendRequestsPanel
- [ ] Expected: Incoming requests listed
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.2.3: View Request Message**
- [ ] Look at received request
- [ ] Expected: Optional message from sender displayed
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.2.4: Accept Request**
- [ ] Click "Accept" button on request
- [ ] Expected: User moves to Friends list
- [ ] Badge count decreases
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.2.5: Decline Request**
- [ ] Click "Decline" button on request
- [ ] Expected: Request removed from list
- [ ] Badge count decreases
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.2.6: View Sent Requests**
- [ ] Click "Sent" tab in FriendRequestsPanel
- [ ] Expected: Outgoing pending requests listed
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

### **3.3 Cancel Outgoing Requests** (2 test cases)

**Test 3.3.1: Cancel Sent Request**
- [ ] In "Sent" tab, click "Cancel" on request
- [ ] Expected: Request removed from list
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.3.2: Cancelled Request Notification (Recipient)**
- [ ] Have recipient check their received requests
- [ ] Expected: Cancelled request no longer visible
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

### **3.4 Remove Friends** (3 test cases)

**Test 3.4.1: Open Friend Actions Menu**
- [ ] Hover/click on friend in FriendsList
- [ ] Expected: Three-dot menu or action buttons appear
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.4.2: Remove Friend with Confirmation**
- [ ] Click "Remove" in actions menu
- [ ] Expected: Confirmation modal appears
- [ ] Click "Confirm"
- [ ] Expected: Friend removed from list
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.4.3: Cancel Remove Action**
- [ ] Click "Remove", then "Cancel" in modal
- [ ] Expected: Friend NOT removed
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

### **3.5 Block/Unblock Users** (4 test cases)

**Test 3.5.1: Block User**
- [ ] Open friend actions menu
- [ ] Click "Block" button
- [ ] Expected: Confirmation modal appears
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.5.2: Blocked User Not in Search**
- [ ] Block a user
- [ ] Try to search for them in Add Friend
- [ ] Expected: Blocked user NOT shown in search results
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.5.3: Blocked User Cannot Send Request**
- [ ] Have blocked user try to send you friend request
- [ ] Expected: Request rejected or blocked
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.5.4: Unblock User**
- [ ] (Implementation needed) Unblock a blocked user
- [ ] Expected: User appears in search again
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

### **3.6 Online Status Tracking** (4 test cases)

**Test 3.6.1: Online Friend Shows Green Dot**
- [ ] Have a friend login while you're online
- [ ] Expected: Green dot appears next to their name
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.6.2: Offline Friend Shows No Dot**
- [ ] Have a friend logout
- [ ] Wait for polling update (2-5 seconds)
- [ ] Expected: Green dot disappears
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.6.3: Online Status Polling**
- [ ] Keep Friends panel open for 10 seconds
- [ ] Expected: HTTP polling occurs (check network tab, every 2s)
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.6.4: Status Updates in Real-Time**
- [ ] Have friend change status (login/logout)
- [ ] Expected: Status updates within 2-5 seconds
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

### **3.7 DM Integration** (3 test cases)

**Test 3.7.1: Message Button Opens DM**
- [ ] Click "Message" in friend actions menu
- [ ] Expected: Chat panel switches to DM mode
- [ ] Conversation with friend opens
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.7.2: DM Opens with Correct Friend**
- [ ] Click "Message" on specific friend
- [ ] Expected: DM conversation is with that exact friend
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 3.7.3: Click @Mention Opens Friend DM**
- [ ] Click on friend's @mention in chat
- [ ] Expected: If they're a friend, DM opens
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

## 🎯 **INTEGRATION TESTING**

### **4.1 Cross-Feature Integration** (5 test cases)

**Test 4.1.1: Friends in @Mention Autocomplete**
- [ ] Type "@" in chat
- [ ] Expected: Friends appear at top of autocomplete list
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 4.1.2: DM to Friend from Multiple Paths**
- [ ] Test: @mention click → DM
- [ ] Test: Friends panel "Message" → DM
- [ ] Test: Player search → DM
- [ ] Expected: All paths open correct conversation
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 4.1.3: Badge Updates Across Panels**
- [ ] Receive friend request
- [ ] Expected: Badge appears on Friends button
- [ ] Accept request
- [ ] Expected: Badge count decreases
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 4.1.4: Profanity Filter in DMs**
- [ ] Send DM with profanity
- [ ] Expected: Profanity filtered in DM too
- [ ] Status: ⬜ PASS | ⬜ FAIL

**Test 4.1.5: All Panels Coexist**
- [ ] Open Friends panel (bottom-right)
- [ ] Open Chat panel (bottom-left)
- [ ] Expected: Both panels visible, no overlap issues
- [ ] Status: ⬜ PASS | ⬜ FAIL

---

## 📊 **TESTING SUMMARY**

**Test Results:**
- Total Test Cases: 48
- Passed: ___ / 48
- Failed: ___ / 48
- Skipped: ___ / 48

**Critical Bugs Found:**
1. _________________________________
2. _________________________________
3. _________________________________

**Minor Issues Found:**
1. _________________________________
2. _________________________________
3. _________________________________

**Performance Notes:**
- HTTP polling frequency: ___________
- DM load time: ___________
- Friend search response time: ___________

**Testing Completed:** ____________________  
**Tester Name:** ____________________  
**Sprint 2 Status:** ⬜ READY FOR PRODUCTION | ⬜ NEEDS FIXES

---

## ✅ **NEXT STEPS**

After completing this testing checklist:

1. **If all tests pass:**
   - Mark Sprint 2 as COMPLETE in progress.md
   - Move FID-20251026-019 to completed.md
   - Update roadmap.md with next sprint
   - Deploy to production

2. **If tests fail:**
   - Document failed tests in issues.md
   - Create fix FIDs for critical bugs
   - Retest after fixes
   - Update testing checklist

3. **Documentation:**
   - Update README with new features
   - Create user guides for DM and Friends
   - Update API documentation

---

**END OF SPRINT 2 TESTING CHECKLIST**
