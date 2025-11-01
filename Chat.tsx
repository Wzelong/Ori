"use client";
import { useState, useRef, useEffect } from "react";
import {
  PaperClipOutlined,
  UpCircleOutlined,
  EditOutlined,
} from "@ant-design/icons";
import Image from "next/image";
import { Spin, Upload, ConfigProvider } from "antd";
import TypingText from "./TypingText";
import "@/styles/scrollbar.css";
import UploadedFile from "./UploadedFile";
import axios from "axios";

// Define the type for a message
type UploadedFile = {
  fileType: string;
  fileName: string;
};

type Message = {
  type: string;
  content: string;
  state: string; // STATIC, LOADING, or TYPING
  uploadedFiles?: UploadedFile[]; // Array of objects with fileType and fileName
};

const getChatGPTResponse = async (userPrompt: string) => {
  try {
    const response = await axios.post("/api/chatgpt", {
      prompt: userPrompt,
    });

    //console.log("ChatGPT Response:", response.data.message);
    return response.data.message;
  } catch (error) {
    console.error("Error fetching ChatGPT response:", error);
  }
};

const Chat: React.FC = () => {
  const chatRef = useRef<HTMLDivElement>(null);
  const [userInput, setUserInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [displayedFiles, setDisplayedFiles] = useState<File[]>([]);
  // const [imageToTextResults, setImageToTextResults] = useState<string[]>([]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() && uploadedFiles.length === 0) return;
    const newMessages = [
      ...messages,
      {
        type: "user",
        content: userInput.trim(),
        state: "STATIC",
        uploadedFiles:
          uploadedFiles?.map((file) => ({
            fileType: file.type,
            fileName: file.name,
          })) || [],
      },
      { type: "ai", content: "", state: "LOADING" },
    ];
    setMessages(newMessages);
    setUserInput("");
    setDisplayedFiles([]);
    const convertImageToText = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Image = reader.result as string; // Base64 image data
          // Pass the base64 image to the API and resolve the LaTeX result
          axios
            .post("/api/imageToText", { base64Image })
            .then((response) => {
              resolve(response.data.latex); // Resolve the LaTeX result
            })
            .catch((error) => {
              console.error("Error uploading file:", error);
              reject(error);
            });
        };
        reader.readAsDataURL(file);
      });
    };

    try {
      const latexResults = await Promise.all(
        uploadedFiles.map((file: File) => convertImageToText(file))
      );
      console.log("Image to Text Results:", latexResults);
      const combinedText = `${userInput.trim()} ${latexResults.join(" ")}`;
      console.log("Combined Text:", combinedText);
      const aiResponse = await getChatGPTResponse(combinedText);
      //const aiResponse = "This is a response from ChatGPT";
      console.log("ChatGPT Response:", aiResponse);
      const updatedMessages = newMessages.map((message, index) =>
        index === newMessages.length - 1
          ? { ...message, content: aiResponse, state: "TYPING" }
          : message
      );
      setMessages(updatedMessages);
      setUploadedFiles([]);
    } catch (error) {
      console.error("Error processing files:", error);
    }
  };

  const handleFileUpload = (file: File) => {
    setUploadedFiles((prevFiles) => [...prevFiles, file]);
    setDisplayedFiles((prevFiles) => [...prevFiles, file]);
    /*
    // Convert the file to base64 on the client side
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Image = reader.result; // Base64 image data

      // Pass the base64 image to the API
      axios
        .post("/api/imageToText", { base64Image }) // Directly pass base64 image
        .then((response) => {
          //setLatexResult(response.data.latex); // Display LaTeX result
          console.log("Image to Text Response:", response.data);
          //console.log("Image to Text Response:", response.data.message.content);
        })
        .catch((error) => {
          console.error("Error uploading file:", error);
        });
    };

    reader.readAsDataURL(file); // Converts the file to base64
    */
    return false;
  };

  const handleFileDelete = (fileName: string) => {
    setUploadedFiles((prevFiles) =>
      prevFiles.filter((prevFile) => prevFile.name !== fileName)
    );
    setDisplayedFiles((prevFiles) =>
      prevFiles.filter((prevFile) => prevFile.name !== fileName)
    );
  };

  useEffect(() => {
    setMessages([
      {
        type: "ai",
        content: "Hello! How can I help you today?",
        state: "TYPING",
      },
    ]);
  }, []);

  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (displayedFiles.length > 0) {
      setIsExpanded(true);
    }
  }, [displayedFiles]);

  return (
    <ConfigProvider
      theme={{
        components: {
          Spin: {
            colorPrimary: "#44403c",
          },
        },
      }}
    >
      <div className="flex flex-col h-full w-full">
        <div
          className="custom-scrollbar w-full flex-grow overflow-y-scroll"
          ref={chatRef}
        >
          {messages.map((message, index) => (
            <div
              key={index}
              className="w-full flex items-start box-border gap-2 p-1.5"
            >
              {message.type === "ai" ? (
                <Image
                  src="/logo_light.png"
                  alt="AI Avatar"
                  className="rounded-full bg-transparent"
                  width={40}
                  height={40}
                />
              ) : (
                <div
                  className="rounded-full bg-transparent"
                  style={{
                    width: 40,
                    height: 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <EditOutlined style={{ fontSize: 24 }} />
                </div>
              )}
              <div className="w-11/12 pt-2 box-border leading-6 min-w-0">
                {message.state === "LOADING" ? (
                  <Spin />
                ) : message.state === "TYPING" ? (
                  <TypingText text={message.content} chatRef={chatRef} />
                ) : (
                  <>{message.content}</>
                )}

                {message.uploadedFiles && message.uploadedFiles.length > 0 && (
                  <div className="flex gap-2 w-full pb-2 mt-2 h-[65px] overflow-x-auto custom-scrollbar">
                    {message.uploadedFiles.map((file, index) => (
                      <UploadedFile
                        key={index}
                        fileType={file.fileType}
                        fileName={file.fileName}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div
          className={`relative w-full border ${
            isFocused ? "border-black" : "border-stone-400"
          } bg-stone-200 ${
            isExpanded ? "rounded-3xl" : "rounded-full"
          } p-3 flex items-center justify-center`}
        >
          <Upload
            showUploadList={false}
            accept="file"
            multiple
            beforeUpload={handleFileUpload}
          >
            <PaperClipOutlined
              className="text-lg cursor-pointer absolute left-3 bottom-3.5"
              style={{ fontSize: "20px" }}
            />
          </Upload>

          <div className="flex flex-col w-[88%] sm:w-[93%] items-center">
            {displayedFiles.length > 0 && (
              <div className="flex gap-2 w-full h-[65px] pb-2 overflow-x-auto custom-scrollbar">
                {displayedFiles.map((file, index) => (
                  <UploadedFile
                    key={index}
                    fileType={file.type}
                    fileName={file.name}
                    handleFileDelete={handleFileDelete}
                  />
                ))}
              </div>
            )}
            <textarea
              className="pl-1 flex-grow mx-10 max-h-[180px] w-full resize-none border-none focus:outline-none overflow-y-auto custom-scrollbar bg-transparent"
              rows={1}
              value={userInput}
              placeholder="Type your message..."
              onChange={(e) => setUserInput(e.target.value)}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${target.scrollHeight}px`;
                setIsExpanded(
                  target.scrollHeight > 40 || displayedFiles.length > 0
                );
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyPress}
            />
          </div>

          <UpCircleOutlined
            className="text-lg cursor-pointer absolute right-3 bottom-3.5"
            style={{
              fontSize: "20px",
              cursor:
                userInput.trim() !== "" || uploadedFiles.length > 0
                  ? "pointer"
                  : "not-allowed",
              color:
                userInput.trim() !== "" || uploadedFiles.length > 0
                  ? "black"
                  : "#a8a29e",
              transition: "color 0.2s",
            }}
            onClick={handleSendMessage}
          />
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Chat;
