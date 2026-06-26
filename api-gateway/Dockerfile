FROM nginx:alpine

ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx
ENV CORS_ALLOWED_ORIGIN=*

COPY nginx.conf /etc/nginx/templates/nginx.conf.template

EXPOSE 3000
