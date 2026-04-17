# MES1 Project Integration Analysis

This document analyzes the architecture and business logic of the `mes1` project to facilitate its integration into the `workforce-portal`.

## 1. Routing & Content Management Logic

The `mes1` application uses a **URL-First State Management** approach, which is ideal for kiosk-type industrial terminals.

### URL Structure
The system relies on a strictly defined path hierarchy: 
`/[project]/[section]/[area_name]?panel=[id]`

*   **Project**: `uretim` or `home`
*   **Section**: `montaj`, `makine`, `atolye`, etc.
*   **Area Name**: `kalite`, `tezgah`, `cila`, etc.
*   **Panel**: Used to differentiate between multiple screens on the same station.

### Implementation Pattern
1.  **Extraction**: In `layout.js`, `usePathname()` is used to split the URL into parts.
2.  **Global Sync**: The extracted `area_name` is immediately dispatched to Redux (`setAreaName`).
3.  **Conditional Layouts**: Component rendering is branched based on these variables. Instead of dozens of unique pages, a single core component renders differently based on the `area_name`.

---

## 2. "Kalite" (Quality) Screen Logic Analysis

The `kalite` screen is handled within the multi-purpose `<Section />` component. Its specific behavior is triggered when `areaName === "kalite"`.

### UI Composition
*   **LeftSideBtnArea**: Contains global terminal actions (Shift Start/End, Breaks).
*   **JobTable**: Queries and displays the queue of jobs assigned to the "Kalite" area.
*   **BreakTable (Bottom-Left)**: Specifically rendered in `kalite` (and a few others) to track personnel breaks directly in the main view.
*   **ProcessArea (Bottom-Center)**: Tracks the status of the currently active quality control process.
*   **RightSideBtnArea**: Contextual buttons for the selected job in the `JobTable`.

### Workflow
1.  **Authentication**: Operatives scan their ID (likely through a popup or initial screen).
2.  **Job Selection**: Operative selects a task from the `JobTable`.
3.  **Work Execution**: The active job moves to the "Process Area".
4.  **Quality Result Entry**: When finishing a task, the `finishedWorkPopup` (managed in `layout.js`) is triggered. This is where quality measurements, pass/fail status, and rework details are entered.

---

## 3. Button Logic & Operation Conditions

The interface is divided into two primary action areas, each with specific validation rules.

### A. Left Side (Terminal & Personnel Management)
Manages the operative's session and environmental actions.

*   **Logout**:
    *   *Condition*: Requires confirmation.
    *   *Special*: In `cila` (Polishing), it wipes `sessionStorage` and performs a hard page refresh.
*   **Break (Mola)**:
    *   *Condition*: Checks if an ID scan is required (Kiosk mode). 
    *   *Validation*: Prevents multiple simultaneous breaks.
*   **Return from Break**:
    *   *Logic*: Records `end_time` and triggers a manpower recalculation via `getJoinTheField`.
*   **Retry Pattern**: If an action requires identity (`isRequiredUserId`) but none is provided, the system stores the action in `retryAction`, opens an ID popup, and auto-resumes after a successful scan.

### B. Right Side (Production & Quality Operations)
Drives the manufacturing lifecycle. Highly dynamic based on `areaName`.

*   **Job Control (Start/Stop/Finish)**:
    *   *General Rule*: Transitions must be valid (e.g., cannot Finish what is not Started).
    *   *Batch Mode*: Most stations support multi-select for batch processing.
*   **Kalite (Quality Control) Specifics**:
    *   *Constraint*: Only one job can be processed at a time for finishing.
    *   *Condition*: Work status must be `1` (Active) or `2` (Stopped).
    *   *Action*: Triggers `FinishedWorkPopup` for mandatory data entry.
*   **Setup vs. Process**:
    *   Tracks machine preparation time separately from actual production time.
*   **Rework/Cancel**:
    *   *Condition*: Typically requires operative ID confirmation in secure stations.

---

## 4. Recommended Migration Strategy to Workforce Portal

To improve performance and resolve fetch errors found in the original project:

1.  **Architecture**: Shift from manual `useEffect` fetches to **TanStack Query (React Query)**. This solves race conditions and provide robust caching.
2.  **Routing**: Introduce a `/terminal` route prefix in `workforce-portal` using React Router's dynamic sub-routes.
3.  **State**: Move away from heavy Redux reliance for UI state; use React Query for server state and simple context/Zustand for UI state.
4.  **Type Safety**: Create shared TypeScript interfaces for `Job`, `ProductionArea`, and `QualityMeasurement`.

---

## Technical Notes for Developers
*   The original project uses **Next.js (App Router)** but functions like a **SPA (Single Page Application)**.
*   Most "screens" are actually **Popups** overlayed on the `Section` component.
*   The `layout.js` acts as a central event/popup dispatcher.
