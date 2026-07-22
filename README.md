# 🎓 Guardian Tutor App

### A Modern Tutoring & Student Management Platform

<p align="center">

  <a href="https://tutors-diary-1037849528770.asia-southeast1.run.app">
    <img src="https://img.shields.io/badge/🚀_Live_Demo-Visit_App-2ea44f?style=for-the-badge" alt="Live Demo">
  </a>

  <a href="https://github.com/Apurba213/guardian-tutor-app">
    <img src="https://img.shields.io/badge/💻_Source_Code-GitHub-181717?style=for-the-badge&logo=github" alt="Source Code">
  </a>

</p>

> A full-stack web application designed to help tutors and guardians manage students, monitor academic progress, track attendance, manage tutoring operations, and make data-driven decisions.

---

## ✨ Key Features

- 👨‍🏫 **Tutor Workspace** — Manage students and tutoring activities
- 👨‍👩‍👧 **Guardian Dashboard** — Monitor student progress and academic performance
- 📅 **Attendance Management** — Track student attendance and engagement
- 📊 **Academic Analytics** — Visualize student performance and progress
- 💰 **Salary & Payment Tracking** — Manage tutoring-related financial records
- 📚 **Syllabus Milestones** — Track academic goals and syllabus progress
- 🤖 **AI-Powered Learning Features** — Support personalized learning and study planning
- 🔍 **Tutor Matching** — Help connect students and guardians with suitable tutors

---
---

## 🖥️ Application Preview

### 🏠 Landing Page

![Guardian Tutor App - Landing Page](./assets/landing-page.png)

### 👨‍🏫 Tutor Dashboard

![Guardian Tutor App - Tutor Dashboard](./assets/tutor-dashboard.png)

### 👨‍👩‍👧 Guardian Dashboard

![Guardian Tutor App - Guardian Dashboard](./assets/guardian-dashboard.png)

### 📊 Analytics Dashboard

![Guardian Tutor App - Analytics Dashboard](./assets/attendance-dashboard.png)

---
---

## 🛠️ Tech Stack

### 🎨 Frontend

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

### 🗄️ Backend & Data

![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Firestore](https://img.shields.io/badge/Cloud_Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)

### 📊 Data Visualization

![Recharts](https://img.shields.io/badge/Recharts-22B5BF?style=for-the-badge)

### ☁️ Deployment

![Google Cloud Run](https://img.shields.io/badge/Google_Cloud_Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)

---
---

## 🧠 Development Approach

This project was initially prototyped using **Google AI Studio** and developed through an AI-assisted software development workflow.

The application was then configured, tested, refined, and deployed as a functional web application, with a focus on building a practical platform for tutoring management and student progress tracking.

The development process involved:

- 🧩 Designing and refining application features
- 🎨 Building and improving the user interface
- 🗄️ Integrating Firebase and Cloud Firestore
- 📊 Implementing dashboards and data visualization
- 🔐 Configuring authentication and application access
- 🧪 Testing application functionality
- 🚀 Deploying the application to Google Cloud Run

This project demonstrates practical experience with **AI-assisted development, modern frontend engineering, cloud services, database integration, and application deployment**.

---
---

## 🏗️ Application Architecture

The application follows a modern frontend and cloud-based architecture:

```text
┌─────────────────────────────────────────────┐
│                User Interface               │
│                                             │
│         React + TypeScript + Vite           │
│              Tailwind CSS                   │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│             Application Layer               │
│                                             │
│      React Components & Application Logic   │
│                                             │
│     • Tutor Workspace                       │
│     • Guardian Dashboard                    │
│     • Student Management                    │
│     • Attendance Tracking                   │
│     • Academic Analytics                    │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│             Firebase Services               │
│                                             │
│      Authentication & Cloud Firestore       │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│               Cloud Deployment              │
│                                             │
│              Google Cloud Run               │
└─────────────────────────────────────────────┘
