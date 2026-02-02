# **Design System**

*(UI Foundation for a Clean, Institutional, Modern Experience)*

---

## **1\. Design Principles**

Our  interface is designed to be:

* **Clear:** information is easy to scan and understand  
* **Trustworthy:** visual consistency and calm colors inspire confidence  
* **Accessible:** high contrast, readable typography, keyboard-friendly  
* **Institutional-Modern:** professional without being cold  
* **Focused:** visual design never distracts from the task

---

## **2\. Color System**

### **Primary Brand Colors**

| Role | Color | Usage |
| ----- | ----- | ----- |
| Primary | \#B9375D | Main actions (buttons, links, highlights) |
| Secondary | \#D25D5D | Hover states, secondary actions, accents |
| Soft Accent | \#E7D3D3 | Badges, dividers, subtle backgrounds |
| Neutral Base | \#EEEEEE | App background |

### **Supporting Neutrals**

| Color | Usage |
| ----- | ----- |
| \#FFFFFF | Card backgrounds |
| \#F5F5F5 | Secondary backgrounds |
| \#2E2E2E | Primary text |
| \#6B6B6B | Secondary text |
| \#CCCCCC | Borders / dividers |

### **Status Colors**

| Status | Color | Usage |
| ----- | ----- | ----- |
| Success | \#4CAF50 | Approved, returned |
| Warning | \#FFC107 | Pending validation |
| Error | \#E53935 | Rejected, errors |
| Info | \#2196F3 | Informational messages |

---

## **3\. Typography**

### **Font Family**

**Primary:** Inter  
Fallbacks: system-ui, sans-serif

### **Font Scale**

| Role | Size | Weight |
| ----- | ----- | ----- |
| Page Title | 24px | 600 |
| Section Title | 18px | 600 |
| Body | 14–16px | 400 |
| Small / Meta | 12px | 400 |
| Buttons | 14px | 500 |

### **Usage Rules**

* Titles always semi-bold  
* Body text regular  
* Avoid ultra-light fonts  
* No decorative fonts

---

## **4\. Layout & Spacing**

### **Spacing System (8px grid)**

| Token | Value |
| :---: | :---: |
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 32px |

Use consistently across padding, margins, gaps.

---

## **5\. Components**

### **Buttons**

#### **Primary Button**

* Background: \#B9375D  
* Text: White  
* Hover: \#D25D5D  
* Radius: 8px  
* Height: 40px  
* Shadow: subtle

#### **Secondary Button**

* Background: Transparent  
* Border: \#B9375D  
* Text: \#B9375D  
* Hover: Soft accent background

---

### **Inputs & Forms**

* Height: 40px  
* Border radius: 8px  
* Border: \#CCCCCC  
* Focus: border \#B9375D \+ subtle glow  
* Error state: border \#E53935

Forms must always show:

* validation messages  
* required indicators  
* helper text where relevant

---

### **Cards**

Used for:

* Item previews  
* Claims  
* Security dashboard tiles

Style:

* Background: White  
* Border-radius: 12px  
* Shadow: subtle (no heavy drop shadows)  
* Padding: 16–24px

---

### **Badges / Status Chips**

| Status | Style |
| ----- | ----- |
| Pending | Yellow background \+ dark text |
| Validated | Blue background \+ white text |
| Returned | Green background \+ white text |
| Rejected | Red background \+ white text |

---

## **6\. Use of Blur (Glass Effect)**

Blur must be **subtle and functional**, never decorative.

### **Allowed use:**

* Modal background overlay  
* Drawer overlays  
* Focus states when highlighting an item

### **Rules:**

* Use low blur values (4–8px)  
* Never blur text containers  
* Never blur primary content areas  
* No glassmorphism on cards or main UI

---

## **7\. Iconography**

* Use a single icon set (Lucide / Heroicons)  
* Stroke icons preferred over filled  
* Consistent size (20–24px)  
* Icons must always have labels (no icon-only actions)

---

## **8\. Accessibility**

* WCAG AA contrast ratios  
* No color-only meaning  
* All forms keyboard accessible  
* All actions reachable without mouse  
* Screen-reader-friendly labels

---

## **9\. UX Guidelines**

### **Forms**

* Progressive disclosure (don’t show everything at once)  
* Step-based for reports (optional)  
* Clear confirmation after submission

### **Feedback**

* Every action has visual feedback  
* Loading indicators always present  
* Empty states are informative and friendly

### **Error Handling**

* Errors are human-readable  
* Never show raw system messages to users

---

## **10\. UI Tone**

The UI voice is:

* Calm  
* Clear  
* Supportive  
* Never playful or sarcastic  
* Institutional but friendly