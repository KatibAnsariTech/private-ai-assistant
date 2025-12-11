import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X } from 'lucide-react';
import { uploadExcel } from '../services/api';

const FileUpload = ({ onUploadSuccess }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState(null);

    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);   // REAL progress from backend
    const [status, setStatus] = useState(null);     // success | error | null
    const [message, setMessage] = useState('');

    const fileInputRef = useRef(null);

    // =============================
    // SSE → REAL BACKEND PROGRESS
    // =============================
    useEffect(() => {
        const evtSource = new EventSource(`${import.meta.env.VITE_API_URL}/api/progress`);

        evtSource.onmessage = (e) => {
            const data = JSON.parse(e.data);

            // Backend sends percent ONLY while batching
            if (data?.percent !== undefined) {
                setProgress(Number(data.percent));
            }
        };

        return () => evtSource.close();
    }, []);


    // =============================
    // FILE VALIDATION
    // =============================
    const validateAndSetFile = (selectedFile) => {
        if (!selectedFile) return;

        const validTypes = [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel"
        ];

        if (!validTypes.includes(selectedFile.type) &&
            !selectedFile.name.endsWith(".xlsx") &&
            !selectedFile.name.endsWith(".xls")
        ) {
            setStatus("error");
            setMessage("Please upload a valid Excel file (.xlsx or .xls)");
            return;
        }

        setFile(selectedFile);
        setStatus(null);
        setMessage('');
        setProgress(0);
    };


    // =============================
    // UPLOAD HANDLER (NO FAKE PROGRESS)
    // =============================
    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setProgress(0);
        setStatus(null);

        try {
            const response = await uploadExcel(file);

            setStatus('success');
            setMessage(`Uploaded ${response.data.rows} rows in ${response.data.time}s`);

            if (onUploadSuccess) onUploadSuccess();

            setTimeout(() => {
                setFile(null);
                setProgress(0);
                setStatus(null);
                setUploading(false);
            }, 4000);

        } catch (error) {
            setStatus('error');
            setMessage(error.response?.data?.error || "Upload failed");
            setUploading(false);
        }
    };


    const clearFile = () => {
        setFile(null);
        setStatus(null);
        setMessage('');
        setProgress(0);

        if (fileInputRef.current) fileInputRef.current.value = '';
    };


    // =============================
    // RENDER UI
    // =============================
    return (
        <div className="w-full max-w-2xl mx-auto mb-8">
            <div
                className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 
                ${isDragging ? 'border-accent-purple bg-accent-purple/10 scale-[1.02]'
                    : file ? 'border-primary-500 bg-primary-500/5'
                        : 'border-slate-600 hover:border-slate-400 bg-slate-800/30'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { 
                    e.preventDefault(); 
                    setIsDragging(false); 
                    validateAndSetFile(e.dataTransfer.files[0]); 
                }}
            >

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => validateAndSetFile(e.target.files[0])}
                    className="hidden"
                    accept=".xlsx, .xls"
                />

                <div className="p-8 flex flex-col items-center justify-center text-center min-h-[200px]">

                    {/* ------------------------- */}
                    {/* SELECT FILE SCREEN        */}
                    {/* ------------------------- */}
                    {!file ? (
                        <>
                            <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-primary-400 to-accent-purple flex items-center justify-center shadow-lg">
                                <Upload className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Upload Excel File</h3>
                            <p className="text-slate-400 mb-6 max-w-sm">
                                Drag and drop your Excel file here, or click to browse.
                            </p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-6 py-2.5 rounded-full bg-slate-700 hover:bg-slate-600 text-white"
                            >
                                Browse Files
                            </button>
                        </>
                    ) : (

                        /* ------------------------- */
                        /* UPLOAD + PROGRESS SCREEN  */
                        /* ------------------------- */
                        <div className="w-full">
                            <div className="flex items-center justify-between mb-6 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                                        <FileSpreadsheet className="w-6 h-6 text-green-400" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-semibold text-white truncate max-w-[200px]">{file.name}</p>
                                        <p className="text-sm text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                </div>

                                {!uploading && !status && (
                                    <button onClick={clearFile} className="p-2 hover:bg-slate-700 rounded-full">
                                        <X className="w-5 h-5 text-slate-400" />
                                    </button>
                                )}
                            </div>

                            {(uploading || status) ? (
                                <div className="space-y-4">

                                    {/* PROGRESS BAR */}
                                    <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-300 
                                            ${status === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-primary-500 to-accent-purple'}`}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>

                                    {/* PROGRESS STATUS TEXT */}
                                    <div className="flex items-center justify-center gap-2 text-slate-300">

                                        {/* WHEN progress = 0 → uploading file */}
                                        {uploading && progress === 0 && (
                                            <span className="animate-pulse">Uploading file...</span>
                                        )}

                                        {/* WHEN progress > 0 → backend started batching */}
                                        {uploading && progress > 0 && (
                                            <span className="animate-pulse">Processing... {progress}%</span>
                                        )}

                                        {status === 'success' && (
                                            <span className="text-green-400 flex items-center gap-2 font-medium">
                                                <CheckCircle className="w-5 h-5" /> {message}
                                            </span>
                                        )}

                                        {status === 'error' && (
                                            <span className="text-red-400 flex items-center gap-2 font-medium">
                                                <AlertCircle className="w-5 h-5" /> {message}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={handleUpload}
                                    className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-accent-purple text-white font-bold"
                                >
                                    Upload File
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FileUpload;
