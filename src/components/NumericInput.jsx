import React, { useState, useEffect } from 'react';
import { parseFraction } from '../utils/units';

/**
 * A controlled numeric input component that buffers changes in a local string state.
 * This prevents the input from resetting or losing cursor positions when typing partial
 * values (such as a lone minus sign "-", trailing decimal points "1.", or empty inputs "").
 * Now supports parsing fractional inputs (e.g. 1 1/2, 1-1/2, 3/4) and unit suffixes.
 */
const NumericInput = ({ value, onChange, ...props }) => {
    const [localVal, setLocalVal] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    // Sync with external value changes (e.g., store updates, undo/redo) only when not focused
    useEffect(() => {
        if (!isFocused) {
            const formatted = value !== undefined && value !== null ? value.toString() : '';
            setLocalVal(formatted);
        }
    }, [value, isFocused]);

    const handleChange = (e) => {
        const valStr = e.target.value;
        setLocalVal(valStr);

        // Try parsing to float (supporting fractions and stripping ")
        const parsed = parseFraction(valStr);
        // Only trigger onChange if we have a fully valid number
        if (!isNaN(parsed) && valStr.trim() !== '' && valStr !== '-' && valStr !== '+') {
            onChange(parsed);
        }
    };

    const handleFocus = (e) => {
        setIsFocused(true);
        if (props.onFocus) props.onFocus(e);
    };

    const handleBlur = (e) => {
        setIsFocused(false);
        // Restore external value if the current local string is invalid or empty
        const parsed = parseFraction(localVal);
        if (isNaN(parsed) || localVal.trim() === '' || localVal === '-' || localVal === '+') {
            setLocalVal(value !== undefined && value !== null ? value.toString() : '');
        } else {
            // Normalize the display string
            setLocalVal(parsed.toString());
        }
        if (props.onBlur) props.onBlur(e);
    };

    return (
        <input
            type="text"
            value={localVal}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
        />
    );
};

export default NumericInput;
