#!/usr/bin/env python3
"""Kleiner lokaler Webserver für die Library-App.
Wie `python3 -m http.server`, aber mit Teilabrufen (Range), damit sich
Audiodateien spulen lassen. Nur von diesem Rechner aus erreichbar."""
import os, re, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        self._remain = None
        rng = self.headers.get('Range')
        path = self.translate_path(self.path)
        m = re.match(r'bytes=(\d*)-(\d*)$', (rng or '').strip())
        if not m or not os.path.isfile(path) or (m.group(1) == '' and m.group(2) == ''):
            return super().send_head()
        size = os.path.getsize(path)
        a, b = m.groups()
        if a == '':
            start, end = max(0, size - int(b)), size - 1
        else:
            start, end = int(a), (int(b) if b else size - 1)
        end = min(end, size - 1)
        if start > end:
            self.send_error(416, 'Bereich nicht erfüllbar')
            return None
        f = open(path, 'rb')
        f.seek(start)
        self._remain = end - start + 1
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.send_header('Content-Length', str(self._remain))
        self.end_headers()
        return f

    def copyfile(self, source, outputfile):
        try:
            if self._remain is None:
                return super().copyfile(source, outputfile)
            left = self._remain
            while left > 0:
                chunk = source.read(min(65536, left))
                if not chunk:
                    break
                outputfile.write(chunk)
                left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass  # Browser hat den Abruf abgebrochen (z. B. beim Spulen)

    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, *args):
        pass

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8778
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
