rm /tmp/monitor-do53-socket
sudo tcpdump -l udp port 53 | nc -l -U /tmp/monitor-do53-socket
