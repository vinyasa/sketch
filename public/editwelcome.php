<?php
/**
 * Luceysketch Welcome Message Editor
 * 
 * Securely edits `welcome.txt` on the Namecheap server.
 */

// Define password for saving changes (change this to whatever you'd like!)
define('ACCESS_PASSWORD', 'woodworker');

$message = '';
$error = '';
$success = '';

$txt_file = __DIR__ . '/welcome.txt';

// Handle POST request (saving changes)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = isset($_POST['password']) ? $_POST['password'] : '';
    $content = isset($_POST['content']) ? $_POST['content'] : '';

    if ($password !== ACCESS_PASSWORD) {
        $error = '❌ Invalid password. Changes were not saved.';
    } else {
        if (file_put_contents($txt_file, $content) !== false) {
            $success = '✨ Welcome message updated successfully!';
        } else {
            $error = '❌ Failed to write to welcome.txt. Check folder permissions.';
        }
    }
}

// Read current content of welcome.txt
if (file_exists($txt_file)) {
    $current_content = file_get_contents($txt_file);
} else {
    $current_content = '';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Luceysketch — Edit Welcome Message</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #121417;
            --panel-bg: rgba(22, 26, 30, 0.75);
            --border-color: rgba(255, 255, 255, 0.12);
            --text-main: #f0f0f0;
            --text-muted: #8e9cae;
            --accent-color: #bc8a5f;
            --accent-hover: #a6764f;
            --shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            margin: 0;
            padding: 40px 20px;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            min-height: 100vh;
            box-sizing: border-box;
        }

        .container {
            max-width: 1200px;
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
        }

        @media (max-width: 900px) {
            .container {
                grid-template-columns: 1fr;
            }
        }

        .editor-section, .preview-section {
            background: var(--panel-bg);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 32px;
            box-shadow: var(--shadow);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }

        h2 {
            margin-top: 0;
            margin-bottom: 24px;
            font-size: 1.4rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--text-main);
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 12px;
        }

        .alert {
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 0.9rem;
            margin-bottom: 20px;
            font-weight: 500;
        }

        .alert-success {
            background: rgba(40, 167, 69, 0.1);
            color: #28a745;
            border: 1px solid rgba(40, 167, 69, 0.2);
        }

        .alert-error {
            background: rgba(220, 53, 69, 0.1);
            color: #dc3545;
            border: 1px solid rgba(220, 53, 69, 0.2);
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 20px;
        }

        label {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--accent-color);
        }

        textarea {
            width: 100%;
            height: 300px;
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            color: var(--text-main);
            padding: 16px;
            font-family: inherit;
            font-size: 0.95rem;
            line-height: 1.6;
            resize: vertical;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.2s;
        }

        textarea:focus {
            border-color: var(--accent-color);
        }

        input[type="password"] {
            width: 100%;
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            color: var(--text-main);
            padding: 12px 16px;
            font-size: 0.95rem;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.2s;
        }

        input[type="password"]:focus {
            border-color: var(--accent-color);
        }

        .btn-submit {
            background: var(--accent-color);
            color: #ffffff;
            border: none;
            border-radius: 8px;
            padding: 12px 28px;
            font-size: 0.95rem;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
            box-shadow: 0 4px 12px rgba(188, 138, 95, 0.25);
            align-self: flex-start;
        }

        .btn-submit:hover {
            background: var(--accent-hover);
        }

        .btn-submit:active {
            transform: scale(0.98);
        }

        /* Dialog Mockup Preview Styles */
        .preview-dialog {
            background: #1c2127;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 16px;
            padding: 32px;
            width: 100%;
            box-sizing: border-box;
            position: relative;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        }

        .dialog-accent {
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 4px;
            background: linear-gradient(90deg, #bc8a5f 0%, #ff5100 100%);
            border-radius: 16px 16px 0 0;
        }

        .dialog-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
        }

        .dialog-title {
            margin: 0;
            font-size: 1.4rem;
            font-weight: 700;
            letter-spacing: 0.5px;
        }

        .dialog-body {
            font-size: 0.92rem;
            line-height: 1.65;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .dialog-para {
            margin: 0;
        }

        .dialog-signoff {
            margin: 0;
            font-style: italic;
            background: rgba(188, 138, 95, 0.05);
            padding: 12px 16px;
            border-radius: 8px;
            border-left: 3px solid var(--accent-color);
        }

        .dialog-footer {
            display: flex;
            justify-content: flex-end;
            margin-top: 24px;
        }

        .dialog-btn {
            background: var(--accent-color);
            color: #fff;
            padding: 10px 28px;
            font-weight: bold;
            border-radius: 6px;
            border: none;
            font-size: 0.9rem;
            opacity: 0.85;
        }

        .bold-text {
            color: var(--accent-color);
            font-weight: bold;
        }
        
        .hint-text {
            font-size: 0.8rem;
            color: var(--text-muted);
            line-height: 1.4;
            margin-top: -8px;
            margin-bottom: 12px;
        }
    </style>
</head>
<body>

<div class="container">
    
    <!-- EDITOR PANEL -->
    <div class="editor-section">
        <h2>🛠️ Welcome Message Editor</h2>

        <?php if ($success): ?>
            <div class="alert alert-success"><?php echo $success; ?></div>
        <?php endif; ?>

        <?php if ($error): ?>
            <div class="alert alert-error"><?php echo $error; ?></div>
        <?php endif; ?>

        <form method="POST" style="display: flex; flex-direction: column; gap: 20px;">
            <div class="form-group">
                <label for="content">Welcome Message Content</label>
                <p class="hint-text">Separate paragraphs using a blank line (double enter). Use double asterisks <code>**like this**</code> to highlight words in gold.</p>
                <textarea id="content" name="content" required placeholder="Write your welcome message here..."><?php echo htmlspecialchars($current_content); ?></textarea>
            </div>

            <div class="form-group">
                <label for="password">Security Password</label>
                <input type="password" id="password" name="password" required placeholder="Enter password to authorize save...">
            </div>

            <button type="submit" class="btn-submit">💾 Save Changes</button>
        </form>
    </div>

    <!-- LIVE DIALOG PREVIEW -->
    <div class="preview-section">
        <h2>👁️ Live Dialog Preview</h2>
        <p class="hint-text" style="margin-bottom: 24px;">This is exactly how the dialog will look to visitors inside the Luceysketch application.</p>

        <div class="preview-dialog">
            <div class="dialog-accent"></div>
            
            <div class="dialog-header">
                <span style="font-size: 2rem;">🪵</span>
                <h3 class="dialog-title">Welcome to Luceysketch</h3>
            </div>

            <div class="dialog-body" id="preview-body">
                <!-- Javascript will inject processed paragraphs here -->
            </div>

            <div class="dialog-footer">
                <button class="dialog-btn" disabled>Let's Go!</button>
            </div>
        </div>
    </div>

</div>

<script>
    const textarea = document.getElementById('content');
    const previewBody = document.getElementById('preview-body');

    function parseMarkdown(text) {
        // Parse bold tags **text** -> <span class="bold-text">text</span>
        return text.replace(/\*\*(.*?)\*\*/g, '<span class="bold-text">$1</span>');
    }

    function updatePreview() {
        const text = textarea.value.trim();
        if (!text) {
            previewBody.innerHTML = '<p class="dialog-para" style="color: var(--text-muted); font-style: italic;">No content entered. Write some text to preview.</p>';
            return;
        }

        const paragraphs = text.split(/\n\s*\n/);
        let html = '';

        paragraphs.forEach((para, idx) => {
            const isLast = idx === paragraphs.length - 1;
            const parsedText = parseMarkdown(para.replace(/\n/g, '<br>'));

            if (isLast) {
                html += `<div class="dialog-signoff">${parsedText}</div>`;
            } else {
                html += `<p class="dialog-para">${parsedText}</p>`;
            }
        });

        previewBody.innerHTML = html;
    }

    // Run preview on load and on any keyup/change events
    textarea.addEventListener('input', updatePreview);
    updatePreview();
</script>

</body>
</html>
