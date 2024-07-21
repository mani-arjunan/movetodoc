FROM redis:alpine3.20

COPY /data .

ENTRYPOINT [ "redis-server", "--port", "6380", "--dbfilename", "dump.rdb", "--dir", "/data" ]
