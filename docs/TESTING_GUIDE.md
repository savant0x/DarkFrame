# 🧪 Authentication System Testing Guide

## 🚀 Quick Start

**Server is running at: http://localhost:3000**

---

## Test Scenarios

### ✅ Test 1: New User Registration

1. Navigate to http://localhost:3000
2. Should redirect to `/login`
3. Click "Register here" link
4. Fill out the form:
   - **Username**: Choose 3-20 characters (letters, numbers, hyphens, underscores)
   - **Email**: Use a valid email format
   - **Password**: Must be 8+ chars, 1 uppercase, 1 lowercase, 1 number
   - **Confirm Password**: Match the password exactly
5. Watch the password strength indicator change as you type
6. Click "CREATE ACCOUNT"
7. **Expected**: Redirect to `/game` with your player spawned

**Test variations:**
- Try weak password (less than 8 chars) → should show error
- Try mismatched passwords → should show error  
- Try duplicate username → should show error
- Try duplicate email → should show error

---

### ✅ Test 2: User Login

1. Go to http://localhost:3000 (or click logout if already logged in)
2. Should see `/login` page
3. Enter email and password from registration
4. Click "LOGIN"
5. **Expected**: Redirect to `/game` with your player at saved position

**Test variations:**
- Try wrong password → should show error "Invalid credentials"
- Try non-existent email → should show error "Invalid credentials"
- Try invalid email format → should show error "Invalid email format"

---

### ✅ Test 3: Logout

1. While in `/game`, scroll down in the right ControlsPanel
2. Click the red "LOGOUT" button at the bottom
3. **Expected**: 
   - Cookie cleared
   - Redirected to `/login`
   - Cannot access `/game` without logging back in

---

### ✅ Test 4: Cookie Persistence

1. Login successfully and reach `/game`
2. Note your current position on the map
3. **Refresh the page** (F5 or Ctrl+R)
4. **Expected**: 
   - Should still be logged in
   - Should be at the same position
   - Game state preserved

---

### ✅ Test 5: Password Strength Indicator

1. Go to `/register`
2. Focus on the password field
3. Type different passwords and watch the indicator:
   - `"test"` → No indicator (too short)
   - `"testing1"` → Red bar, "Weak" (no uppercase)
   - `"Testing1"` → Yellow bar, "Fair" (meets minimum)
   - `"Testing123"` → Blue bar, "Good" (strong length)
   - `"Testing@123"` → Green bar, "Strong" (special char)

---

### ✅ Test 6: Confirm Password Validation

1. Go to `/register`
2. Enter password: `"Testing123"`
3. In confirm password field, type:
   - `"T"` → Red "✗ Passwords do not match"
   - `"Testing12"` → Red "✗ Passwords do not match"
   - `"Testing123"` → Green "✓ Passwords match"

---

### ✅ Test 7: Game Integration

1. Login and reach `/game`
2. Test that Phase 1 features still work:
   - Press `G` on Metal/Energy tiles → Harvest modal opens
   - Press `F` on Cave tiles → Cave exploration modal opens
   - Press `I` → Inventory panel opens
   - Check HarvestStatus indicator at top center
3. **Expected**: All game features work normally with authentication

---

## 🔍 Backend Testing (API Endpoints)

### Test Registration API

```bash
# PowerShell
$body = @{
    username = "testuser"
    email = "test@example.com"
    password = "Testing123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" -Method POST -Body $body -ContentType "application/json"
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "player": { ...player data without password... },
    "currentTile": { ...tile data... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### Test Login API

```bash
# PowerShell
$body = @{
    email = "test@example.com"
    password = "Testing123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Body $body -ContentType "application/json"
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "player": { ...player data without password... },
    "currentTile": { ...tile data... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### Test Logout API

```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/logout" -Method POST
```

**Expected response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 🐛 What to Look For

### Security Checks:
- [ ] Passwords are **never** shown in API responses
- [ ] Passwords are **never** shown in browser DevTools (Network tab)
- [ ] JWT token is in cookie, not localStorage
- [ ] Cookie has `httpOnly` flag (check DevTools → Application → Cookies)
- [ ] Cookie expires in 7 days (check cookie details)

### Validation Checks:
- [ ] Cannot register with weak password
- [ ] Cannot register with invalid email
- [ ] Cannot register with duplicate email (case-insensitive)
- [ ] Cannot register with duplicate username
- [ ] Cannot login with wrong password
- [ ] Cannot login with wrong email

### UX Checks:
- [ ] Loading states show during API calls
- [ ] Error messages are clear and helpful
- [ ] Password strength indicator updates in real-time
- [ ] Confirm password validation updates in real-time
- [ ] Forms are disabled during submission
- [ ] Success redirects happen automatically

---

## 📊 Database Verification

Check the database to verify data is stored correctly:

1. Connect to the Postgres database (`DATABASE_URL` in `.env.local`)
2. View the `players` table
3. Verify:
   - [ ] `email` field exists on new players
   - [ ] `password` field is a bcrypt hash (starts with `$2b$`)
   - [ ] Emails are stored in lowercase
   - [ ] No duplicate emails exist

---

## ✅ Success Criteria

Authentication system is working correctly if:
- ✅ New users can register with email/password
- ✅ Users can login with correct credentials
- ✅ Users cannot login with wrong credentials
- ✅ Password validation enforces strong passwords
- ✅ Users can logout and are redirected to login
- ✅ Cookies persist across browser refreshes
- ✅ JWT tokens are generated correctly
- ✅ Passwords are hashed in database
- ✅ All game features work after authentication
- ✅ No sensitive data exposed in responses

---

## 🚨 If Something Doesn't Work

### Issue: "Cannot read properties of null"
**Solution**: Make sure Postgres is reachable and `.env.local` has correct `DATABASE_URL`

### Issue: "Invalid token"
**Solution**: Check that `JWT_SECRET` is set in `.env.local`

### Issue: "Network error" or timeout
**Solution**: Ensure dev server is running (`npm run dev`)

### Issue: TypeScript errors in Problems panel
**Solution**: These are false positives (JSX type errors). Code compiles fine.

### Issue: Cookie not persisting
**Solution**: Check browser DevTools → Application → Cookies. Should see `darkframe_session` with 7-day expiry.

---

## 🎉 Ready to Test!

Start testing at: **http://localhost:3000**

**Current server status:**
```
▲ Next.js 15.0.2
- Local:        http://localhost:3000
- Environments: .env.local
✓ Ready
```
