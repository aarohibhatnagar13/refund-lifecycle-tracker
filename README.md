# Refund Lifecycle Tracker

A professional refund management system built with Node.js, Express, and MySQL. This project features a strict state-machine architecture, concurrency control via optimistic locking, and automated background processing.

## Dashboard Preview
![Project Preview](dashboard.png)

## Key Features
- Custom State Machine: Prevents illegal business transitions.
- Optimistic Locking: Uses version-based concurrency control to prevent data corruption.
- Automated SLA Monitoring: Background worker auto-escalates stuck refunds.
- Comprehensive Audit Trail: Every state change is logged with a timestamp and note.
- Vanilla JS Dashboard: A framework-free frontend for managing refunds.

## Tech Stack
- Backend: Node.js, Express.js
- Database: MySQL
- Frontend: HTML5,CSS, Vanilla JavaScript
- Concurrency: Version-based Optimistic Locking
- Automation: setInterval background jobs

## Project Structure
- config/ : Database connection
- jobs/ : Background tasks (SLA Checker)
- models/ : SQL Schema
- public/ : Frontend UI
- routes/ : API Endpoints
- services/ : Business Logic
- utils/ : State Machine Rules
- server.js : App Entry Point

## Installation & Setup

1. Clone the repository:
git clone https://github.com/aarohibhatnagar13/refund-lifecycle-tracker.git
cd refund-lifecycle-tracker

2. Install dependencies:
npm install

3. Database Setup:
- Create a MySQL database named refund_tracker.
- Import the schema from models/schema.sql.

4. Environment Variables:
Create a .env file and add:
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=<img width="1425" height="771" alt="dashboard" src="https://github.com/user-attachments/assets/aad95617-5aae-401f-9556-0b4fe3e4c7f2" />

DB_NAME=refund_tracker

5. Run the application:
node server.js

## Architecture Highlights

State Machine Logic
Validated in utils/stateMachine.js:
- RAISED -> UNDER_REVIEW
- UNDER_REVIEW -> APPROVED or DENIED
- APPROVED -> PROCESSING -> CREDITED

Optimistic Locking
Prevents simultaneous update conflicts using a version column:
UPDATE refunds SET current_state = ?, version = version + 1 WHERE id = ? AND version = ?;

Background SLA Job
Runs every 5 minutes to check for breaches:
- UNDER_REVIEW: 24h limit
- APPROVED: 12h limit

## API Endpoints
- GET /api/refunds : List all refunds
- POST /api/refunds : Raise a new refund
- GET /api/refunds/:id : Get refund details and history
- PATCH /api/refunds/:id/state : Transition a refund state
- POST /api/refunds/dev/run-sla-check : Trigger SLA watchdog

## Testing Concurrency
Use the "Simulate Race Condition" button on the Detail page. It fires two simultaneous requests; one succeeds (200) and one fails (409), proving data integrity.

