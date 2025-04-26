
# CostNest Security Policy

##  Supported Versions
We provide security updates for the following versions:

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

##  Reporting a Vulnerability

**Please DO NOT** report security vulnerabilities through public GitHub issues.

### Secure Reporting Channels:
1. **Email**: security@yourdomain.com (Preferred)
2. **Encrypted**: Use our [PGP Key](link-to-pgp-key) (Key fingerprint: `AAAA BBBB CCCC DDDD`)
3. **Private Vulnerability Report**: GitHub's [Private Reporting](https://github.com/la-b-ib/CostNest/security/advisories/new)

### What to Include:
- Detailed description of the vulnerability
- Steps to reproduce
- Impact assessment
- Any suggested mitigations

##  Security Features

### PIN Protection System
- Default PIN: `1234` (must be changed on first use)
- PBKDF2 hashing with 10,000 iterations
- Auto-lock after 60 seconds of inactivity
- No external transmission of PIN data

### Data Security
- All expense data stored locally using Chrome's `chrome.storage.local` API
- Backup files encrypted with AES-256 when exported
- Memory wiping after PIN lock activates

### Chrome Permissions
```json
"permissions": [
  "storage",
  "alarms"
],
"optional_permissions": []
```

##  Update Policy
- Critical vulnerabilities: Patches within 72 hours
- High-risk vulnerabilities: Patches within 7 days
- Medium vulnerabilities: Addressed in next scheduled release

##  Recognition
We credit security researchers who responsibly disclose vulnerabilities in our [SECURITY.md](SECURITY.md) file.

##  Known Limitations
1. Local storage is not encrypted at rest (mitigated by PIN protection)
2. Browser extensions inherently have access to DOM of visited pages
3. Backup files stored unencrypted if user doesn't set password

##  Secure Development Practices
- Code reviews required for all changes
- Automated vulnerability scanning using [GitHub CodeQL](https://codeql.github.com/)
- Dependency updates monitored via [Dependabot](https://dependabot.com/)
- No third-party analytics or tracking

##  Compliance
- GDPR compliant data handling
- Follows [Chrome Web Store Security Guidelines](https://developer.chrome.com/docs/webstore/security/)
- Implements [OWASP Extension Security Guidelines](https://owasp.org/www-project-application-security-verification-standard/)

---

## Project Documentation

<div style="display: flex; gap: 10px; margin: 15px 0; align-items: center; flex-wrap: wrap;">

[![License](https://img.shields.io/badge/License-See_FILE-007EC7?style=for-the-badge&logo=creativecommons)](LICENSE)
[![Security](https://img.shields.io/badge/Security-Policy_%7C_Reporting-FF6D00?style=for-the-badge&logo=owasp)](SECURITY.md)
[![Contributing](https://img.shields.io/badge/Contributing-Guidelines-2E8B57?style=for-the-badge&logo=git)](CONTRIBUTING.md)
[![Code of Conduct](https://img.shields.io/badge/Code_of_Conduct-Community_Standards-FF0000?style=for-the-badge&logo=opensourceinitiative)](CODE_OF_CONDUCT.md)

</div>

## Contact Information



  
[![Email](https://img.shields.io/badge/Email-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:labib.45x@gmail.com)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/la-b-ib)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/la-b-ib/)
[![Portfolio](https://img.shields.io/badge/Website-0A5C78?style=for-the-badge&logo=internet-explorer&logoColor=white)](https://la-b-ib.github.io/)
[![X](https://img.shields.io/badge/X-000000?style=for-the-badge&logo=twitter&logoColor=white)](https://x.com/la_b_ib_)

