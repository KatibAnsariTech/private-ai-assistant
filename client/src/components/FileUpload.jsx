import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X } from 'lucide-react';
import { uploadExcel } from '../services/api';

const FileUpload = ({ onUploadSuccess }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState(null); // 'success', 'error', null
    const [message, setMessage] = useState('');
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        validateAndSetFile(droppedFile);
    };

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        validateAndSetFile(selectedFile);
    };

    const validateAndSetFile = (selectedFile) => {
        if (!selectedFile) return;

        // Check file type
        const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
        if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
            setStatus('error');
            setMessage('Please upload a valid Excel file (.xlsx or .xls)');
            return;
        }

        setFile(selectedFile);
        setStatus(null);
        setMessage('');
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setProgress(0);
        setStatus(null);

        // Simulate progress since axios upload progress is fast for small files
        const progressInterval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 90) return prev;
                return prev + 10;
            });
        }, 200);

        try {
            const response = await uploadExcel(file);
            clearInterval(progressInterval);
            setProgress(100);
            setStatus('success');
            setMessage(`Successfully uploaded ${response.data.rows} rows in ${response.data.time}s`);
            if (onUploadSuccess) onUploadSuccess();

            // Reset after delay
            setTimeout(() => {
                setFile(null);
                setProgress(0);
                setStatus(null);
                setMessage('');
                setUploading(false);
            }, 5000);
        } catch (error) {
            clearInterval(progressInterval);
            setStatus('error');
            setMessage(error.response?.data?.error || 'Upload failed. Please try again.');
            setUploading(false);
        }
    };

    const clearFile = () => {
        setFile(null);
        setStatus(null);
        setMessage('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto mb-8">
            <div
                className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ${isDragging
                        ? 'border-accent-purple bg-accent-purple/10 scale-[1.02]'
                        : file
                            ? 'border-primary-500 bg-primary-500/5'
                            : 'border-slate-600 hover:border-slate-400 bg-slate-800/30'
                    }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".xlsx, .xls"
                />

                <div className="p-8 flex flex-col items-center justify-center text-center min-h-[200px]">
                    {!file ? (
                        <>
                            <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-primary-400 to-accent-purple flex items-center justify-center shadow-lg shadow-primary-500/30 animate-pulse-slow">
                                <Upload className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Upload Excel File</h3>
                            <p className="text-slate-400 mb-6 max-w-sm">
                                Drag and drop your Excel file here, or click to browse.
                                Supported formats: .xlsx, .xls
                            </p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-6 py-2.5 rounded-full bg-slate-700 hover:bg-slate-600 text-white font-medium transition-all hover:shadow-lg border border-slate-600"
                            >
                                Browse Files
                            </button>
                        </>
                    ) : (
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
                                    <button
                                        onClick={clearFile}
                                        className="p-2 hover:bg-slate-700 rounded-full transition-colors"
                                    >
                                        <X className="w-5 h-5 text-slate-400" />
                                    </button>
                                )}
                            </div>

                            {uploading || status ? (
                                <div className="space-y-4">
                                    <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-300 ${status === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-primary-500 to-accent-purple'
                                                }`}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-center gap-2">
                                        {uploading && <span className="text-slate-300 animate-pulse">Uploading... {progress}%</span>}
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
                                    className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-accent-purple text-white font-bold shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transform hover:-translate-y-0.5 transition-all"
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
