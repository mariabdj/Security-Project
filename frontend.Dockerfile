# frontend.Dockerfile in the root directory

# Use a lightweight Nginx image
FROM nginx:alpine

# Copy the frontend files to Nginx's web root
COPY frontend/ /usr/share/nginx/html

# Expose port 80 (Nginx default)
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]