# **Contracts Guide (Backend ↔ Frontend)**

## **Purpose**

This document defines the **API-facing contracts** shared conceptually between the Backend and the Frontend.  
Since the project is developed by different team members, the goal is to keep both sides aligned while keeping codebases **separated**.

A “contract” here means:

* data shapes (DTOs / models)  
* enums (statuses, roles)  
* API endpoints and payload expectations  
* error response format

The Backend is the source of truth for runtime rules.  
The Frontend mirrors these contracts to render UI and validate forms.

---

## **Contract Rules**

1. **Backend owns business logic**  
   * state transitions  
   * authorization rules  
   * validation rules beyond simple field format  
2. **Frontend mirrors shapes**  
   * models match backend DTOs  
   * never invent fields that the backend does not return  
3. **Stable naming**  
   * use consistent casing and names across both sides  
   * prefer explicit enums over free-text strings  
4. **Breaking changes**  
   * if a contract changes (field name/type/status), it must be documented and communicated before merge.

---

## **Backend Contract Structure (Node.js \+ Express \+ TypeScript)**

### **Suggested Folder Layout**

backend/src/  
  contracts/  
    enums/  
    dtos/  
    types/  
    responses/  
    index.ts

### **What goes where**

#### **contracts/enums/**

**Purpose:** shared constants that define allowed values.

Examples:

* itemStatus.enum.ts  
  Values: REPORTED, PENDING\_VALIDATION, VALIDATED, CLAIMED, RETURNED, ARCHIVED  
* claimStatus.enum.ts  
  Values: PENDING, APPROVED, REJECTED, CANCELLED  
* userRole.enum.ts (internal users only)  
  Values: SECURITY, ADMIN

#### **contracts/types/**

**Purpose:** domain-level types used internally or returned by the API.

Examples:

* report.type.ts  
* item.type.ts  
* claim.type.ts

These types represent the system concepts and align with Firestore entities.

#### **contracts/dtos/**

**Purpose:** request/response payload shapes for the API.

Recommended naming pattern:

* CreateLostReportRequest.dto.ts  
* CreateFoundReportRequest.dto.ts  
* CreateClaimRequest.dto.ts  
* ItemPublicResponse.dto.ts  
* ItemDetailsResponse.dto.ts

DTOs should represent what the API expects and returns — not necessarily the raw database object.

#### **contracts/responses/**

**Purpose:** standardized API responses and error formats.

* ErrorResponse.ts  
* ApiResponse.ts (optional wrapper)  
* Pagination.ts (optional if needed later)

**Standard Error Response**

{  
  "error": {  
    "code": "FORBIDDEN",  
    "message": "You are not allowed to perform this action"  
  }  
}

#### **contracts/index.ts**

**Purpose:** single export point for contracts used by the rest of the backend.

---

## **Frontend Contract Structure (Angular \+ TypeScript)**

### **Suggested Folder Layout**

frontend/src/app/  
  models/  
    enums/  
    dtos/  
    types/  
    responses/  
    index.ts

### **What goes where**

#### **models/enums/**

Mirror backend enums 1:1.

* item-status.enum.ts  
* claim-status.enum.ts  
* user-role.enum.ts (if needed for internal UI)

#### **models/types/**

App-level types used for UI state and feature logic.

* report.type.ts  
* item.type.ts  
* claim.type.ts

#### **models/dtos/**

HTTP payload shapes used by Angular services.

* create-lost-report.request.dto.ts  
* create-found-report.request.dto.ts  
* create-claim.request.dto.ts  
* item-public.response.dto.ts

Keep DTO names consistent with backend as much as possible (just adapt casing style if needed).

#### **models/responses/**

Standard error response and optional pagination types.

* error-response.model.ts  
* pagination.model.ts

#### **models/index.ts**

Single export point for imports inside the frontend.

---

## **Required Contracts (MVP)**

### **Enums**

* ItemStatus  
* ClaimStatus  
* UserRole (internal)

### **DTOs / Models**

**Reports**

* Create Lost Report (request)  
* Create Found Report (request)  
* Report reference code (response field)

**Items**

* Public item list item (response)  
* Item detail (response)

**Claims**

* Create claim (request)  
* Claim status (response field)

### **Standard Error Response**

* ErrorResponse (same structure in both repos)

---

## **Contract Sync Checklist (Team Workflow)**

When changing any contract:

1. Update backend contract files  
2. Update frontend mirrored contract files  
3. Update docs/contracts.md with the change  
4. Notify teammate (message \+ short summary of what changed)