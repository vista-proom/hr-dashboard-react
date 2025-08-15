# Railway Deployment Guide

This guide explains how to deploy the HR Dashboard React application to Railway as a single service.

## Prerequisites

- Railway account
- GitHub repository access
- Node.js 18+ installed locally

## Railway Configuration

### 1. Build Command
```bash
npm --prefix client ci && npm --prefix client run build && npm --prefix server ci
```

### 2. Start Command
```bash
npm --prefix server start
```

### 3. Environment Variables

Set these environment variables in your Railway service:

#### Required Variables
- `PORT`: Railway will set this automatically
- `JWT_SECRET`: Generate a secure random string for JWT tokens
- `DATABASE_FILE`: Set to `/tmp/database.sqlite` for Railway's ephemeral filesystem

#### Optional Variables
- `CLIENT_URL`: Set to your Railway domain (e.g., `https://your-app.railway.app`)
- `NODE_ENV`: Set to `production`

### 4. Example Environment Variables
```env
JWT_SECRET=your-super-secure-jwt-secret-key-here
DATABASE_FILE=/tmp/database.sqlite
CLIENT_URL=https://your-app.railway.app
NODE_ENV=production
```

## Local Development vs Production

### Development
- Client runs on `http://localhost:5173`
- Server runs on `http://localhost:4000`
- API calls proxied through Vite dev server
- Database file: `server/database.sqlite`

### Production (Railway)
- Single service serves both client and server
- Client build served from Express static middleware
- API routes at `/api/*`
- Database file: `/tmp/database.sqlite` (ephemeral)

## File Structure Changes

### Server (`server/index.js`)
- Added static file serving for React build
- Added SPA fallback route
- Updated PORT configuration
- Added ES module `__dirname` equivalent

### Database (`server/src/db.js`)
- Made database file path configurable
- Added environment variable support for `DATABASE_FILE`

### Client (`client/src/api.js`)
- Added environment variable support for API base URL
- Production: `/api` (relative to domain)
- Development: `/api` (proxied through Vite)

### Vite Config (`client/vite.config.js`)
- Removed hardcoded localhost URLs
- Added environment variable support for proxy target
- Optimized build configuration

## Deployment Steps

1. **Connect Repository**
   - Connect your GitHub repository to Railway
   - Select the repository: `vista-proom/hr-dashboard-react`

2. **Configure Build**
   - Build Command: `npm --prefix client ci && npm --prefix client run build && npm --prefix server ci`
   - Start Command: `npm --prefix server start`

3. **Set Environment Variables**
   - Add all required environment variables
   - Ensure `DATABASE_FILE=/tmp/database.sqlite`

4. **Deploy**
   - Railway will automatically build and deploy
   - Monitor build logs for any issues

## Important Notes

### Database Persistence
- Railway uses ephemeral filesystem
- Database will be reset on each deployment
- Consider using Railway's PostgreSQL plugin for production data

### File Uploads
- Upload directory (`server/uploads`) is ephemeral
- Files will be lost on redeployment
- Consider using external storage (AWS S3, Cloudinary, etc.)

### Environment Variables
- Never commit sensitive environment variables
- Use Railway's environment variable management
- Test locally with `.env.local` files

## Troubleshooting

### Build Failures
- Check Node.js version compatibility
- Verify all dependencies are in `package.json`
- Check build logs for specific error messages

### Runtime Errors
- Verify environment variables are set correctly
- Check database file path permissions
- Monitor Railway logs for detailed error information

### API Issues
- Ensure `VITE_API_BASE_URL` is set correctly
- Check CORS configuration
- Verify API routes are working

## Local Testing

To test the production build locally:

1. **Build the client**
   ```bash
   cd client && npm run build
   ```

2. **Set environment variables**
   ```bash
   export DATABASE_FILE=/tmp/database.sqlite
   export NODE_ENV=production
   ```

3. **Start the server**
   ```bash
   cd server && npm start
   ```

4. **Test the application**
   - Open `http://localhost:4000`
   - Verify both client and API work correctly

## Security Considerations

- JWT secrets should be long and random
- Database file should not be accessible publicly
- CORS should be configured for production domains
- HTTPS is automatically handled by Railway

## Performance Optimization

- Client build is optimized for production
- Static assets are served efficiently
- Database queries are optimized
- Socket.IO is configured for production use