# Production Checklist

## Security

- [ ] Change default passwords
- [ ] Ensure `SECRET_KEY` is strong and kept secret
- [ ] Enable HTTPS
- [ ] Set `DEBUG=False` in backend
- [ ] Configure CORS properly (restrict origins)

## Database

- [ ] Backup database
- [ ] Ensure database indexes are created
- [ ] Secure database access (password, firewall)

## Frontend

- [ ] Build for production (`npm run build`)
- [ ] Optimize assets (images, fonts)
- [ ] Check for console errors

## Backend

- [ ] Run tests (`pytest`)
- [ ] Check logs for errors
- [ ] Configure logging (level, rotation)

## Infrastructure

- [ ] Set up monitoring (uptime, errors)
- [ ] Set up backups (frequency, retention)
