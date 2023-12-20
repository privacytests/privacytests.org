rm -f /tmp/monitor-do53-socket
sudo tcpdump -l udp port 53 | tee /dev/tty | nc -l -U /tmp/monitor-do53-socket
