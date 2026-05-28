import React, { useState, useEffect } from 'react';

/**
 * A controlled numeric input component that buffers changes in a local string state.
 * This prevents the input from resetting or losing cursor positions when typing partial
 * values (such as a lone minus sign "-", trailing decimal points "1.", or empty inputs "").
 */
const NumericInput = ({ value, onChange, ...props }) => {
    const [localVal, setLocalVal] = useState('');

    // Sync with external value changes (e.g., store updates, undo/redo, switching selected boards)
    useEffect(() => {
        const formatted = value !== undefined && value !== null ? value.toString() : '';
        setLocalVal(formatted);
    }, [value]);

    const handleChange = (e) => {
        const valStr = e.target.value;
        setLocalVal(valStr);

        // Try parsing to float
        const parsed = parseFloat(valStr);
        // Only trigger onChange if we have a fully valid number
        // (i.e. not a lone minus sign, empty string, etc.)
        if (!isNaN(parsed) && valStr.trim() !== '' && valStr !== '-' && valStr !== '+') {
            onChange(parsed);
        }
    };

    const handleBlur = () => {
        // Restore external value if the current local string is invalid or empty
        const parsed = parseFloat(localVal);
        if (isNaN(parsed) || localVal.trim() === '' || localVal === '-' || localVal === '+') {
            setLocalVal(value !== undefined && value !== null ? value.toString() : '');
        } else {
            // Normalize the display string
            setLocalVal(parsed.toString());
        }
    };

    return (
        <input
            type="number"
            value={localVal}
            onChange={handleChange}
            onBlur={handleBlur}
            {...props}
        />
    );
};

export default NumericInput;
