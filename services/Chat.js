import { FAILED_TO_GET_DATA } from "@/utils/Constants";
import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

export default function Chat({ requestId }) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserImage, setCurrentUserImage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const prevMessageCountRef = useRef(0);


  const fetchMessages = () => {
    if (!socketRef.current || !socketRef.current.connected) return;

    setLoadingMessages(true);
    socketRef.current.emit("getMessagesByRequest", { requestId }, (response) => {
      if (response?.status === "success") {
        const reversed = response.data.reverse(); // oldest first
        setMessages(reversed);

        if (reversed.length > 0) {
          const profile = JSON.parse(localStorage.getItem("userProfile"));
          setCurrentUserId(profile.id);
          setCurrentUserImage(profile.profile_image);
        }
      } else {
        console.log(FAILED_TO_GET_DATA);
      }

      setLoadingMessages(false);
    });
  };


  const connectToSocket = () => {
    const token = localStorage.getItem("refreshToken");

    const socket = io(`paste_url_here`, {
      transports: ["websocket"],
      query: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to WebSocket");
      setIsConnected(true);

      // Start polling every second
      fetchMessages(); // initial fetch
      const intervalId = setInterval(fetchMessages, 1000);
      socketRef.current.fetchIntervalId = intervalId;
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from WebSocket");
      setIsConnected(false);

      // Clear interval when disconnected
      if (socketRef.current?.fetchIntervalId) {
        clearInterval(socketRef.current.fetchIntervalId);
      }
    });

    socket.on("connect_error", (err) => {
      console.error("Connection error:", err);
    });

    socket.on("message", (message) => {
      setMessages((prev) => [...prev, message]);
    });
  };

  const sendMessage = () => {
    if (newMessage.trim() && socketRef.current) {
      const messageData = {
        requestId,
        content: newMessage,
      };

      socketRef.current.emit("sendMessage", messageData, (response) => {
        console.log("Server response:", response);
        if (response.status === "success") {
          const newMsg = {
            ...messageData,
            _id: Date.now().toString(),
            sender: {
              _id: currentUserId,
              first_name: "You",
              profile_image: currentUserImage,
            },
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, newMsg]);
        }
      });

      setNewMessage("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };
  
  useEffect(() => {
    connectToSocket();
    return () => {
      if (socketRef.current) {
        if (socketRef.current.fetchIntervalId) {
          clearInterval(socketRef.current.fetchIntervalId);
        }
        socketRef.current.disconnect();
      }
    };
  }, []);


  useEffect(() => {
    // console.log("Messages updated:", messages);
    // console.log("Messages length:", messages.length);
    if (messages.length > prevMessageCountRef.current) {
      // console.log("Messages length:", messages.length);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  return (
    <div className="chat-ui">
      <div className="chat-lists">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-center mt-20">No messages yet</p>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg._id} className={`item ${msg.sender._id === currentUserId ? 'me-chat-item' : ''}`}>
                <div className="avatar chat-avatar" style={{
                  '--avatar-bg': `url(${msg.sender.profile_image})`
                }} />
                <div className="chat-cont">{msg.content}</div>
              </div>
            ))}
            <div ref={messagesEndRef} /> {/* 👈 this is now inside the loop container */}
          </>
        )}
      </div>

      <div className="chat-action">
        <div className="chat-right-area">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="form-control"
          />
          <button
            onClick={sendMessage}
            disabled={!isConnected || !newMessage.trim()}
            className="btn btn-primary"
          >
            <span className="pi pi-send" />
          </button>
        </div>
      </div>
    </div>
  );
}
