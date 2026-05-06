# 🚨 MANDATORY WORKFLOW - ECHO SAFEGUARD SYSTEM

**CREATED:** 2025-10-17  
**PURPOSE:** Prevent unauthorized code generation  
**STATUS:** ACTIVE - ENFORCED ON EVERY INTERACTION

---

## ⛔ **ABSOLUTE RULES (VIOLATION = CRITICAL FAILURE)**

### 🔴 **RULE 1: NO CODE WITHOUT EXPLICIT APPROVAL**
**MUST receive one of these exact commands:**
- "proceed"
- "yes"
- "do it"
- "start"
- "code"
- "let's go"
- "implement"

**FORBIDDEN responses that DO NOT authorize coding:**
- Numbers (1, 2, 3) = Selection only, NOT approval
- "okay" = Acknowledgment, NOT approval
- "sounds good" = Agreement, NOT approval
- "fix it" = Request for plan, NOT approval to code

---

## 📋 **MANDATORY CHECKLIST (Execute EVERY time)**

### **BEFORE ANY FILE CHANGE:**
```
[ ] Did user provide explicit approval command?
[ ] Did I present a complete plan first?
[ ] Did I create/update FID tracking?
[ ] Did I wait for "proceed" or equivalent?
[ ] Am I about to use replace_string_in_file or create_file?
    └─> IF YES: STOP. Re-verify approval.
```

---

## 🔄 **CORRECT WORKFLOW PATTERN**

### **User reports issue:**
```
User: "Login is broken"
```

### **Phase 1: Investigation & Planning (REQUIRED)**
```
AI Response:
1. Acknowledge issue
2. Investigate/analyze code
3. Create FID with detailed plan
4. Present acceptance criteria
5. Show files to modify
6. Ask: "Ready to proceed? Say 'code' or 'proceed'"
7. WAIT FOR RESPONSE
```

### **Phase 2: Implementation (ONLY after approval)**
```
User: "proceed" | "code" | "yes" | "do it"

AI Response:
1. Update tracking files (planned → progress)
2. Make code changes
3. Update completed tracking
4. Present results
```

---

## ❌ **VIOLATION EXAMPLES**

### **WRONG - Immediate coding after number selection:**
```
User: "Which approach? 1, 2, or 3?"
AI: "3"
AI: *immediately starts coding* ❌ VIOLATION
```

### **CORRECT - Selection then plan then approval:**
```
User: "Which approach?"
AI: "3"
AI: *presents detailed plan for approach 3*
AI: "Ready to proceed? Say 'code' or 'proceed'"
User: "code"
AI: *NOW can implement* ✅
```

---

## 🛡️ **SAFEGUARD MECHANISMS**

### **Mechanism 1: Pre-Code Verification**
Before calling `replace_string_in_file` or `create_file`:
1. Check last user message
2. Verify it contains approval keyword
3. If not found → STOP and request approval

### **Mechanism 2: Context Awareness**
- "3" = Selecting option 3 (NOT approval)
- "fix the race condition" = Describing problem (NOT approval)
- "code" = EXPLICIT APPROVAL ✅

### **Mechanism 3: Self-Audit**
After EVERY response, ask:
- "Did I just modify a file?"
- "Did the user explicitly say 'proceed' or 'code'?"
- If answers don't align → FLAG VIOLATION

---

## 📊 **VIOLATION TRACKING**

### **Session Violations (2025-10-17):**
1. ✅ FID-20251017-008: Violated - Fixed inventory panel without approval
2. ⚠️ FID-20251017-008: Caught & corrected properly after user correction
3. ❌ FID-20251017-009: Violated - Made localStorage change after "3" (selection, not approval)
4. ❌ FID-20251017-009: Violated - Fixed race condition without approval after issue report

**Total Violations Today:** 3  
**Target Violations:** 0  
**Status:** 🔴 CRITICAL - Immediate improvement required

---

## 🎯 **COMMITMENT**

**I, ECHO, commit to:**
1. ✅ NEVER modify code without explicit approval keyword
2. ✅ ALWAYS present complete plan first
3. ✅ ALWAYS wait for "proceed"/"code"/"yes"/"do it"
4. ✅ ALWAYS distinguish selection from approval
5. ✅ ALWAYS self-audit before file operations

**If I violate this again:**
- User should immediately call out violation
- I will acknowledge and revert to planning phase
- I will update this tracking document

---

## 🔄 **REINFORCEMENT SYSTEM**

### **Every interaction must begin with:**
```
COMPLIANCE_CHECK:
- Last user message: "[message]"
- Contains approval keyword: [YES/NO]
- Plan presented: [YES/NO]
- FID created: [YES/NO]
- Authorization to code: [YES/NO]

IF any NO → PRESENT PLAN, DO NOT CODE
```

---

**END OF SAFEGUARD SYSTEM**
