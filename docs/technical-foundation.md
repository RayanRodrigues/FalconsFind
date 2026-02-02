**Technical Foundation Document**

*(Updated – Public Reporting & Security-Centered Model)*

---

## **1\. System Architecture Overview**

FalconFind  is a web-based Lost & Found platform designed as a decoupled system composed of a frontend client, a backend API, and cloud-based services.  
The system prioritizes operational realism by placing Campus Security as the central authority managing the lifecycle of lost and found items.

### **Components**

* **Frontend:** Angular \+ TypeScript \+ TailwindCSS  
  Provides public access for item reporting and browsing, and a secured interface for Campus Security operations.  
* **Backend API:** Node.js \+ Express \+ TypeScript  
  Enforces business logic, validation, authorization, and exposes RESTful endpoints.  
* **Authentication:** Firebase Authentication  
  Used exclusively for internal users (Campus Security and Admin).  
* **Database:** Firebase Firestore  
  Stores all domain entities: reports, items, claims, and logs.  
* **File Storage:** Firebase Storage  
  Used for storing item images.

### **Communication Flow**

Public Users ⇄ Frontend ⇄ Backend API ⇄ Firebase Services  
Internal Users (Security/Admin) ⇄ Frontend ⇄ Backend API ⇄ Firebase Services

All authenticated requests use Bearer tokens issued by Firebase Auth.  
Public endpoints are strictly limited and validated server-side.

---

## **2\. Core Domain Concepts**

### **User Roles**

Only internal users require authentication:

* **SECURITY** – validates found items, approves/rejects claims, manages statuses  
* **ADMIN** – full system access and operational oversight

Public users (students/visitors) interact without accounts.

---

### **Item Lifecycle**

REPORTED → PENDING\_VALIDATION → VALIDATED → CLAIMED → RETURNED → ARCHIVED

* `REPORTED`: Item submitted by a public user  
* `PENDING_VALIDATION`: Awaiting Campus Security verification  
* `VALIDATED`: Approved and publicly visible  
* `CLAIMED`: Ownership claim in progress  
* `RETURNED`: Successfully returned to owner  
* `ARCHIVED`: Closed and no longer active

### **Claim Lifecycle**

PENDING → APPROVED → REJECTED → CANCELLED

Claims are only allowed on `VALIDATED` items.

All state transitions are enforced by the backend service layer.

---

## **3\. API Contract (Conceptual)**

All endpoints are prefixed with:  
`/api/v1`

### **Public Endpoints (No Authentication)**

#### **POST /reports/lost**

Submit a lost item report.

#### **POST /reports/found**

Submit a found item report.

#### **GET /items**

Retrieve publicly visible found items (validated only).

#### **GET /items/{id}**

Retrieve item details (only if validated).

#### **POST /claims**

Submit a structured claim request for a found item.

---

### **Secured Endpoints (SECURITY / ADMIN)**

#### **POST /security/items/{id}/validate**

Validate a found item.

#### **PATCH /security/items/{id}/status**

Update item status.

#### **GET /security/reports**

View all reports (lost & found).

#### **GET /security/claims**

View and manage claims.

#### **PATCH /security/claims/{id}/approve**

#### **PATCH /security/claims/{id}/reject**

---

### **Error Response Format (Standard)**

{

  "error": {

    "code": "FORBIDDEN",

    "message": "You are not allowed to perform this action"

  }

}

---

## **4\. Firestore Data Model**

### **reports**

*(Public submissions before validation)*

{

  "id": "reportId",

  "type": "LOST | FOUND",

  "title": "string",

  "category": "string",

  "description": "string",

  "location": "string",

  "date": "timestamp",

  "photoUrl": "string | null",

  "referenceCode": "string",

  "createdAt": "timestamp"

}

---

### **items**

*(Only created after validation of found reports)*

{

  "id": "itemId",

  "reportId": "reportId",

  "title": "string",

  "category": "string",

  "description": "string",

  "location": "string",

  "date": "timestamp",

  "photoUrl": "string | null",

  "status": "VALIDATED | CLAIMED | RETURNED | ARCHIVED",

  "validatedBy": "securityUserId",

  "validatedAt": "timestamp"

}

---

### **claims**

{

  "id": "claimId",

  "itemId": "itemId",

  "claimantDescription": "string",

  "status": "PENDING | APPROVED | REJECTED | CANCELLED",

  "createdAt": "timestamp",

  "processedBy": "securityUserId | null"

}

---

### **users *(internal only)***

{

  "id": "uid",

  "email": "user@fanshawe.ca",

  "role": "SECURITY | ADMIN",

  "createdAt": "timestamp"

}

---

### **activity\_logs**

{

  "id": "logId",

  "entityType": "REPORT | ITEM | CLAIM",

  "entityId": "string",

  "action": "VALIDATED | STATUS\_CHANGED | CLAIM\_APPROVED | CLAIM\_REJECTED",

  "performedBy": "userId",

  "timestamp": "timestamp"

}

---

## **5\. Backend Architecture Guidelines**

### **Layered Structure**

routes → controllers → services → repositories → firestore

### **Responsibilities**

* **Routes:** Define HTTP endpoints only  
* **Controllers:** Handle request/response logic  
* **Services:** Enforce business rules and state transitions  
* **Repositories:** Isolate Firestore access  
* **Schemas:** Validate input via Zod

### **Rules**

* No Firestore calls in controllers  
* All public inputs validated strictly  
* No business logic in routes  
* Centralized error handling  
* All state transitions go through services

---

## **6\. Frontend Architecture Guidelines (Angular)**

### **Structure**

core/

shared/

features/

  public-reporting/

  public-browsing/

  security-dashboard/

  claims-management/

### **Core**

* API Interceptor  
* Error Interceptor  
* Security Auth Service  
* Role-based Guards

### **Shared**

* UI components  
* Pipes  
* Validators

### **Feature Modules**

Each feature owns:

* pages  
* components  
* services  
* models

### **UI State Requirements**

Every view must explicitly handle:

* loading  
* error  
* empty states

---

## **7\. Validation & Security Principles**

* All public endpoints are rate-limited  
* All secured endpoints require Firebase Auth  
* Role-based access enforced backend-side  
* All file uploads validated by type and size  
* Firestore rules mirror backend authorization  
* Logs created for all sensitive actions

---

## **8\. Definition of Done (Team Agreement)**

A feature is considered complete when:

* Implemented in both frontend and backend  
* Validated via Zod and backend logic  
* Follows API contract  
* Passes lint and formatting  
* Reviewed by at least one teammate  
* Documented in API.md / README

---

## **9\. Non-MVP / Out of Scope**

* User-to-user messaging  
* Push notifications  
* AI-based image recognition  
* Native mobile apps  
* Multi-campus support  
* Integration with Fanshawe internal systems

---

## **10\. Architectural Principles**

* Operational realism over theoretical purity  
* Simplicity over premature abstraction  
* Explicit contracts over implicit assumptions  
* Security by default  
* Modularity over monolithic logic  
* Evolvability over rigidity

---

## **Final Notes**

This document serves as the technical source of truth for .  
All future development must align with these principles and structures to ensure scalability, maintainability, and academic integrity.