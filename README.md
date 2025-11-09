# QueueCTL - Distributed Job Queue System

![QueueCTL](https://img.shields.io/badge/QueueCTL-v1.0.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A514-green)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)

A lightweight, persistent job queue system with SQLite backend, built for simplicity and control. Execute shell commands asynchronously with automatic retries, dead letter queue management, and real-time monitoring.

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Usage](#-usage)
  - [CLI Commands](#cli-commands)
  - [REST API](#rest-api)
- [Architecture](#-architecture)
- [Configuration](#-configuration)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)
- [Development](#-development)
- [License](#-license)

## ✨ Features

- **📦 Persistent Job Queue** - SQLite-backed storage with ACID properties
- **🔄 Automatic Retries** - Exponential backoff with configurable retry policies
- **💀 Dead Letter Queue** - Automatic handling of failed jobs with manual retry capability
- **🌐 Cross-Platform** - Works on Windows, macOS, and Linux
- **🔌 REST API** - Full HTTP API for integration and monitoring
- **📊 Real-time Monitoring** - Track job status, output, and execution metrics
- **⌨️ Simple CLI** - Intuitive command-line interface for job management

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 14
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/nkbiradar/queuectl.git
cd queuectl

# Install dependencies
npm install

# Start the server (creates database automatically)
node src/index.js
