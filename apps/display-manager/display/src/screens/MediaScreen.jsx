import React, { useEffect, useState } from "react";
import DisplayLayout from "../components/DisplayLayout";

// Same-origin: the display's web server forwards /api to the backend.
const API = "/api";

export default function MediaScreen() {

    const [media, setMedia] = useState(null);

    async function loadMedia() {

        try {

            const response = await fetch(
                `${API}/media/current`
            );

            const data = await response.json();

            setMedia(data.file);

        }
        catch (error) {

            console.log(
                "Media error:",
                error
            );

        }

    }


    useEffect(() => {

        loadMedia();

        const timer = setInterval(
            loadMedia,
            1000
        );

        return () => clearInterval(timer);

    }, []);


    return (

        <DisplayLayout fullScreen>

            {
                !media ?

                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            color: "white",
                            fontSize: "2rem"
                        }}
                    >
                        No Media Selected
                    </div>

                    :

                    media.endsWith(".mp4") ||
                    media.endsWith(".webm") ?

                        <video
                            src={`${API}/media/${media}`}
                            autoPlay
                            muted
                            loop
                            playsInline
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                background: "black"
                            }}
                        />

                        :

                        <img
                            src={`${API}/media/${media}`}
                            alt=""
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                background: "black"
                            }}
                        />

            }

        </DisplayLayout>

    );

}
